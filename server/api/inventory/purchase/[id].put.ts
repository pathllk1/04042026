// server/api/inventory/purchase/[id].put.ts
import { defineEventHandler, createError, readBody } from 'h3';
import Bills from '../../../models/inventory/Bills';
import StockReg from '../../../models/inventory/StockReg';
import Party from '../../../models/inventory/Party';
import Stocks from '../../../models/inventory/Stocks';
import mongoose from 'mongoose';
import { createPurchaseBillLedgerTransaction } from '../../../utils/ledgerTransactions';
import { createStockFilter, createStockUpdateSet } from '../../../utils/stockFilterUtils';

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

    // Get the bill ID from the URL
    const id = event.context.params?.id;
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bill ID is required'
      });
    }

    // Find the bill to update
    const existingBill = await Bills.findById(id).session(session);
    if (!existingBill) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Purchase bill not found'
      });
    }

    // Check if the bill is cancelled
    if (existingBill.status === 'CANCELLED') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Cannot update a cancelled purchase bill'
      });
    }

    // Verify that this is a purchase bill
    if (existingBill.btype !== 'PURCHASE') {
      throw createError({
        statusCode: 400,
        statusMessage: 'This is not a purchase bill'
      });
    }

    // Get request body
    const body = await readBody(event);
    let partyId = existingBill.partyId;

    // Handle party updates
    if (body.newParty) {
      // Create a new party
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
      partyId = savedParty._id;
    } else if (body.partyName && body.partyName !== existingBill.supply) {
      // Party name has changed, find the new party
      const existingParty = await Party.findOne({
        supply: body.partyName,
        firm: user.firmId
      }).session(session);

      if (existingParty) {
        partyId = existingParty._id;
      }
    }

    // Get existing stock registrations for comparison
    const existingStockRegs = await StockReg.find({ _id: { $in: existingBill.stockRegIds || [] } }).session(session);

    // Create a map of existing items for easy lookup
    const existingItemsMap = new Map();
    existingStockRegs.forEach(reg => {
      existingItemsMap.set(reg.item, {
        qty: reg.qty,
        hsn: reg.hsn,
        item: reg.item,
        stockId: reg.stockId
      });
    });

    // Create a map of new items for comparison
    const newItemsMap = new Map();
    if (body.stockItems && body.stockItems.length > 0) {
      body.stockItems.forEach((item) => {
        newItemsMap.set(item.item, {
          qty: item.qty,
          hsn: item.hsn,
          item: item.item
        });
      });
    }

    // 1. Handle removed items - subtract their quantities from stock
    for (const [itemName, itemData] of existingItemsMap) {
      if (!newItemsMap.has(itemName)) {
        console.log(`Item removed: ${itemName}, subtracting ${itemData.qty} from stock`);

        // Find the stock record
        const stockFilter: any = {
          item: itemData.item,
          hsn: itemData.hsn,
          firm: user.firmId
        };

        // If we have a stockId, use it for more precise filtering
        if (itemData.stockId) {
          stockFilter._id = itemData.stockId;
        }

        // For purchase, subtract the quantity when removing an item
        const qtyChange = -itemData.qty;

        // Update the stock
        await Stocks.findOneAndUpdate(
          stockFilter,
          { $inc: { qty: qtyChange } },
          { session }
        );
      }
    }

    // Delete existing stock registrations associated with this bill
    if (existingBill.stockRegIds && existingBill.stockRegIds.length > 0) {
      await StockReg.deleteMany({ _id: { $in: existingBill.stockRegIds } }).session(session);
    }

    // Create new stock registrations for each stock item
    const stockRegIds = [];
    if (body.stockItems && body.stockItems.length > 0) {
      for (const item of body.stockItems) {
        // 2 & 3. Handle quantity changes and new items
        const existingItem = existingItemsMap.get(item.item);
        let stockId;

        // Find or create stock record using the utility function
        const stockFilter = createStockFilter(item, user.firmId);

        if (existingItem) {
          // Item exists, calculate quantity difference
          const qtyDiff = item.qty - existingItem.qty;

          // For purchase, add the difference
          const qtyChange = qtyDiff;

          console.log(`Updating existing item: ${item.item}, qty diff: ${qtyDiff}, change: ${qtyChange}`);

          // Prepare the stock update object using the utility function
          const stockUpdateSet = createStockUpdateSet(item, user._id, user.firmId);

          // Update the stock
          const updatedStock = await Stocks.findOneAndUpdate(
            stockFilter,
            {
              $inc: { qty: qtyChange },
              $set: stockUpdateSet
            },
            { upsert: true, new: true, session }
          );

          stockId = updatedStock._id;
        } else {
          // New item, update stock accordingly
          // For purchase, add the quantity
          const qtyChange = item.qty;

          console.log(`Adding new item: ${item.item}, qty: ${item.qty}, change: ${qtyChange}`);

          // Prepare the stock update object using the utility function
          const stockUpdateSet = createStockUpdateSet(item, user._id, user.firmId);

          // Add total calculation for purchase
          stockUpdateSet.total = item.qty * item.rate;

          // Update or create the stock
          const updatedStock = await Stocks.findOneAndUpdate(
            stockFilter,
            {
              $inc: { qty: qtyChange },
              $set: stockUpdateSet
            },
            { upsert: true, new: true, session }
          );

          stockId = updatedStock._id;
        }

        // Get current stock quantity for historical reference
        const currentStock = await Stocks.findById(stockId).session(session);
        const currentQty = currentStock ? currentStock.qty : item.qty;

        // Create StockReg entry with proper handling of optional fields
        const stockRegData: any = {
          type: 'PURCHASE',
          bno: body.bno,
          bdate: body.bdate,
          supply: body.partyName,
          item: item.item,
          hsn: item.hsn,
          qty: item.qty,
          qtyh: currentQty, // Historical quantity (current stock level)
          uom: item.uom,
          rate: item.rate,
          total: item.total,
          user: user._id,
          firm: user.firmId,
          stockId: stockId,
          billId: id
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

        const savedStockReg = await stockReg.save({ session });
        stockRegIds.push(savedStockReg._id);
      }
    }

    // Update the bill with new data
    const updatedBill = await Bills.findByIdAndUpdate(
      id,
      {
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
        sgst: body.sgst,
        igst: body.igst,
        rof: body.rof,
        ntot: body.ntot,
        btype: 'PURCHASE', // Ensure it's still a purchase bill
        orderNo: body.orderNo,
        orderDate: body.orderDate,
        dispatchThrough: body.dispatchThrough,
        docketNo: body.docketNo,
        vehicleNo: body.vehicleNo,
        consigneeName: body.consigneeName,
        consigneeGstin: body.consigneeGstin,
        consigneeAddress: body.consigneeAddress,
        consigneeState: body.consigneeState,
        consigneePin: body.consigneePin,
        oth_chg: body.oth_chg,
        stockRegIds: stockRegIds,
        partyId: partyId
      },
      { new: true, session }
    );

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Create/update ledger transaction for purchase bill
    let ledgerResult = null;
    try {
      // Create/update ledger transaction in Firestore
      ledgerResult = await createPurchaseBillLedgerTransaction(
        updatedBill,
        user._id.toString(),
        user.firmId.toString()
      );
      console.log('Ledger transaction updated for purchase bill:', ledgerResult);
    } catch (ledgerError) {
      console.error('Error updating ledger transaction for purchase bill:', ledgerError);
      // We don't throw here as the bill was already updated successfully
      // Just log the error and continue
    }

    // Return the updated bill
    return {
      message: 'Purchase bill updated successfully',
      bill: updatedBill,
      ledgerTransaction: ledgerResult
    };
  } catch (error: any) {
    // Abort transaction on error
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }

    console.error('Error updating purchase bill:', error);

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to update purchase bill: ${error.message || 'Unknown error'}`
    });
  }
});
