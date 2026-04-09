// server/api/inventory/purchase.post.ts
import { defineEventHandler, createError, readBody } from 'h3';
import Bills from '../../models/inventory/Bills';
import StockReg from '../../models/inventory/StockReg';
import Stocks from '../../models/inventory/Stocks';
import Party from '../../models/inventory/Party';
import mongoose, { Types } from 'mongoose';
import { createPurchaseBillLedgerTransactionMongo } from '../../utils/inventoryLedgerMongo';
import { createStockFilter, createStockUpdateSet } from '../../utils/stockFilterUtils';

export default defineEventHandler(async (event) => {
  let session = null;

  try {
    // Start MongoDB session for transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Ensure user is authenticated and has a firmId
    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const body = await readBody(event);
    let partyId: mongoose.Types.ObjectId | null = null;

    // Create new party if newParty data is available
    if (body.newParty) {
      // Remove temporary ID if present
      const { _id, ...partyData } = body.newParty;
      const party = new Party({
        supply: partyData.supply,
        addr: partyData.addr,
        gstin: partyData.gstin || 'UNREGISTERED',
        state: partyData.state,
        state_code: partyData.state_code,
        pin: partyData.pin,
        pan: partyData.pan,
        contact: partyData.contact,
        usern: user._id,
        firm: user.firmId
      });
      const savedParty = await party.save({ session });
      partyId = savedParty._id as Types.ObjectId;
    } else if (body.partyName) {
      // Find existing party by name
      const existingParty = await Party.findOne({
        supply: body.partyName,
        firm: user.firmId
      }).session(session);

      if (existingParty) {
        partyId = existingParty._id as Types.ObjectId;
      }
    }

    // Process stock items and create/update Stocks and StockReg
    const stockRegs = [];

    // Process each stock item sequentially to avoid transaction conflicts
    for (const item of body.stockItems) {
      // Update or create Stocks
      // Use the utility function to create a standardized filter
      const stockFilter = createStockFilter(item, user.firmId);

      // Use the utility function to create a standardized update object
      const stockUpdateSet = createStockUpdateSet(item, user._id, user.firmId);

      // Add total calculation for purchase
      stockUpdateSet.total = item.qty * item.rate;

      const stockUpdate = {
        $inc: { qty: item.qty }, // For purchase, add the quantity
        $set: stockUpdateSet
      };

      // Use findOneAndUpdate with explicit session
      const stock = await Stocks.findOneAndUpdate(
        stockFilter,
        stockUpdate,
        { upsert: true, new: true, session }
      );
      const nqnty = stock.qty;

      // Create StockReg entry with proper handling of optional fields
      const stockRegData: any = {
        type: 'PURCHASE',
        bno: body.bno,
        bdate: body.bdate,
        supply: body.partyName,
        item: item.item,
        hsn: item.hsn,
        qty: item.qty,
        qtyh: nqnty, // Historical quantity
        uom: item.uom,
        rate: item.rate,
        total: item.total,
        user: user._id,
        firm: user.firmId,
        stockId: stock._id
      };

      // Add optional fields only if they have valid values
      if (item.item_narration) stockRegData.item_narration = item.item_narration;
      if (item.pno && item.pno.trim() !== '') stockRegData.pno = item.pno;
      if (item.batch && item.batch.trim() !== '') stockRegData.batch = item.batch;
      if (item.oem) stockRegData.oem = item.oem;
      if (item.grate) stockRegData.grate = item.grate;
      if (item.cgst) stockRegData.cgst = item.cgst;
      if (item.sgst) stockRegData.sgst = item.sgst;
      if (item.igst) stockRegData.igst = item.igst;
      if (item.disc) {
        stockRegData.disc = item.disc;
        stockRegData.discamt = (item.qty * item.rate) * item.disc / 100;
      }
      if (item.project) stockRegData.project = item.project;
      // Add new optional fields
      if (item.mrp) stockRegData.mrp = item.mrp;
      if (item.expiryDate) stockRegData.expiryDate = item.expiryDate;

      // Create the StockReg instance
      const stockReg = new StockReg(stockRegData);

      // Save the StockReg with the session
      const savedStockReg = await stockReg.save({ session });
      stockRegs.push(savedStockReg);
    }

    // Create the bill
    const bill = new Bills({
      bno: body.bno,
      bdate: body.bdate,
      supply: body.partyName,
      addr: body.partyAddress,
      gstin: body.partyGstin,
      state: body.partyState,
      pin: body.partyPin,
      gtot: body.gtot,
      disc: body.disc,
      cgst: body.cgst,
      usern: user._id,
      sgst: body.sgst,
      firm: user.firmId,
      igst: body.igst,
      rof: body.rof,
      ntot: body.ntot,
      btype: 'PURCHASE', // Explicitly set to PURCHASE
      // Order and dispatch details
      orderNo: body.orderNo,
      orderDate: body.orderDate,
      dispatchThrough: body.dispatchThrough,
      docketNo: body.docketNo,
      vehicleNo: body.vehicleNo,
      // Consignee details
      consigneeName: body.consigneeName,
      consigneeGstin: body.consigneeGstin,
      consigneeAddress: body.consigneeAddress,
      consigneeState: body.consigneeState,
      consigneePin: body.consigneePin,
      narration: body.narration,
      oth_chg: body.oth_chg,
      stockRegIds: stockRegs.map(reg => reg._id),
      partyId: partyId
    });

    // Save the bill with the session
    const savedBill = await bill.save({ session });

    // Update StockReg entries with the bill ID
    for (const stockReg of stockRegs) {
      stockReg.billId = savedBill._id as Types.ObjectId;
      await stockReg.save({ session });
    }

    // Update Party with the bill ID if a party was found or created
    if (partyId) {
      await Party.findByIdAndUpdate(
        partyId,
        { $push: { billIds: savedBill._id } },
        { session }
      );
    }

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Create ledger transaction for purchase bill (Mongo)
    let ledgerResult = null;
    try {
      ledgerResult = await createPurchaseBillLedgerTransactionMongo(
        savedBill,
        user._id.toString(),
        user.firmId.toString()
      );
      console.log('Ledger transaction created for purchase bill:', ledgerResult);
    } catch (ledgerError) {
      console.error('Error creating ledger transaction for purchase bill:', ledgerError);
      // We don't throw here as the bill was already created successfully
      // Just log the error and continue
    }

    return {
      message: 'Purchase bill created successfully',
      bill: savedBill,
      ledgerTransaction: ledgerResult
    };
  } catch (error: any) {
    // Abort transaction on error
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }

    console.error('Error creating purchase bill:', error);

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create purchase bill: ${error.message || 'Unknown error'}`
    });
  }
});
