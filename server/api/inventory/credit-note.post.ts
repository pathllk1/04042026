// server/api/inventory/credit-note.post.ts
import { defineEventHandler, createError, readBody } from 'h3';
import Bills from '../../models/inventory/Bills';
import StockReg from '../../models/inventory/StockReg';
import Stocks from '../../models/inventory/Stocks';
import Party from '../../models/inventory/Party';
import mongoose, { Types } from 'mongoose';
import { createCreditNoteLedgerTransactionMongo } from '../../utils/inventoryLedgerMongo';
import { createStockFilter, createStockUpdateSet } from '../../utils/stockFilterUtils';

export default defineEventHandler(async (event) => {
  let session = null;

  try {
    // Ensure user is authenticated and has a firmId
    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    // Get the request body
    const body = await readBody(event);
    if (!body) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Missing request body'
      });
    }

    // Validate required fields
    if (!body.bno || !body.bdate || !body.partyName || !body.stockItems || body.stockItems.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Missing required fields'
      });
    }

    // Start a MongoDB session for transaction
    session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find or create party
      let party = await Party.findOne({
        name: body.partyName,
        firm: user.firmId
      }).session(session);

      if (!party) {
        party = await Party.create([{
          name: body.partyName,
          gstin: body.gstin || '',
          address: body.address || '',
          state: body.state || '',
          pin: body.pin || '',
          firm: user.firmId,
          user: user._id
        }], { session });
        party = party[0];
      }

      // Create the bill
      const bill = await Bills.create([{
        bno: body.bno,
        bdate: body.bdate,
        btype: 'CREDIT NOTE',
        supply: body.partyName,
        gstin: body.gstin || '',
        address: body.address || '',
        state: body.state || '',
        pin: body.pin || '',
        stot: body.stot,
        dtot: body.dtot || 0,
        ctot: body.ctot || 0,
        gtot: body.gtot || 0,
        rtot: body.rtot || 0,
        ntot: body.ntot,
        firm: user.firmId,
        user: user._id,
        partyId: party._id,
        oth_chg: body.oth_chg || [],
        docketNo: body.docketNo || '',
        vehicleNo: body.vehicleNo || '',
        consigneeName: body.consigneeName || '',
        consigneeGstin: body.consigneeGstin || '',
        consigneeAddress: body.consigneeAddress || '',
        consigneeState: body.consigneeState || '',
        consigneePin: body.consigneePin || '',
        reasonForNote: body.reasonForNote || '',
        originalBillNo: body.originalBillNo || '',
        originalBillDate: body.originalBillDate || null
      }], { session });

      const createdBill = bill[0];
      const stockRegIds = [];

      // Process each stock item
      for (const item of body.stockItems) {
        // For credit note, we're returning items to inventory, so we add to stock
        // Use the utility function to create a standardized filter
        const stockFilter = createStockFilter(item, user.firmId);

        // Use the utility function to create a standardized update object
        const stockUpdateSet = createStockUpdateSet(item, user._id, user.firmId);

        // For credit note, we add the quantity back to stock
        const stockUpdate = {
          $inc: { qty: item.qty },
          $set: stockUpdateSet
        };

        // Use findOneAndUpdate with explicit session
        const stock = await Stocks.findOneAndUpdate(
          stockFilter,
          stockUpdate,
          { upsert: true, new: true, session }
        );
        const nqnty = stock.qty;

        // Create StockReg entry
        const stockRegData: any = {
          type: 'CREDIT NOTE',
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
          stockId: stock._id,
          billId: createdBill._id
        };

        // Add optional fields if they exist
        if (item.pno) stockRegData.pno = item.pno;
        if (item.batch) stockRegData.batch = item.batch;
        if (item.oem) stockRegData.oem = item.oem;
        if (item.item_narration) stockRegData.item_narration = item.item_narration;
        if (item.grate) stockRegData.grate = item.grate;
        if (item.cgst) stockRegData.cgst = item.cgst;
        if (item.sgst) stockRegData.sgst = item.sgst;
        if (item.igst) stockRegData.igst = item.igst;
        if (item.disc) stockRegData.disc = item.disc;
        if (item.discamt) stockRegData.discamt = item.discamt;
        if (item.project) stockRegData.project = item.project;
        if (item.rid) stockRegData.rid = item.rid;
        // Add new optional fields
        if (item.mrp) stockRegData.mrp = item.mrp;
        if (item.expiryDate) stockRegData.expiryDate = item.expiryDate;

        // Create StockReg entry with session
        const stockReg = await StockReg.create([stockRegData], { session });
        stockRegIds.push(stockReg[0]._id);
      }

      // Update bill with stockRegIds
      await Bills.findByIdAndUpdate(
        createdBill._id,
        { stockRegIds },
        { session }
      );

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      const ledgerResult = await createCreditNoteLedgerTransactionMongo(createdBill, user._id.toString(), user.firmId.toString());

      return {
        success: true,
        bill: createdBill,
        ledgerResult
      };
    } catch (error) {
      // Rollback the transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error: any) {
    // Ensure session is ended even if an error occurs
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (sessionError) {
        // Silent catch - just ensure the session is properly ended
      }
    }

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal Server Error'
    });
  }
});
