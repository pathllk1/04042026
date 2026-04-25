import { defineEventHandler, createError, readBody } from 'h3';
import Bills from '../../../models/inventory/Bills';
import StockReg from '../../../models/inventory/StockReg';
import Stocks from '../../../models/inventory/Stocks';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  let session = null;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    const body = await readBody(event);
    const { originalBillId, returnCart, narration } = body;

    if (!originalBillId || !returnCart || returnCart.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields for Credit Note'
      });
    }

    const originalBill = await Bills.findById(originalBillId).session(session);
    if (!originalBill) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Original bill not found'
      });
    }

    // Generate CN number (prefix CN- + original bill number)
    const billNo = `CN-${originalBill.bno}`;

    // Process items and update stock (Credit Note increases stock)
    const stockRegs = [];
    for (const item of returnCart) {
      const stock = await Stocks.findById(item.stockId).session(session);
      if (stock) {
        stock.qty += item.returnQty;
        await stock.save({ session });
      }

      const stockReg = new StockReg({
        type: 'CREDIT NOTE',
        bno: billNo,
        bdate: new Date(),
        supply: originalBill.supply,
        item: item.item,
        qty: item.returnQty,
        qtyh: stock ? stock.qty : 0,
        rate: item.rate,
        grate: item.gstRate,
        disc: item.disc,
        total: item.returnQty * item.rate * (1 - (item.disc || 0) / 100),
        user: user._id,
        firm: user.firmId,
        stockId: item.stockId
      });

      const savedReg = await stockReg.save({ session });
      stockRegs.push(savedReg._id);
    }

    // Create the Credit Note bill document
    // For simplicity, we copy many fields from original bill but with CN types
    const cnBill = new Bills({
      bno: billNo,
      bdate: new Date(),
      supply: originalBill.supply,
      addr: originalBill.addr,
      gstin: originalBill.gstin,
      state: originalBill.state,
      pin: originalBill.pin,
      btype: 'CREDIT NOTE',
      usern: user._id,
      firm: user.firmId,
      narration: narration || `Return against bill ${originalBill.bno}`,
      stockRegIds: stockRegs,
      partyId: originalBill.partyId,
      // Totals calculation would normally happen here
      ntot: returnCart.reduce((sum: number, i: any) => sum + (i.returnQty * i.rate * (1 - (i.disc || 0) / 100)), 0)
    });

    await cnBill.save({ session });

    await session.commitTransaction();

    return {
      success: true,
      id: cnBill._id,
      billNo: cnBill.bno,
      message: 'Credit Note created successfully'
    };

  } catch (error: any) {
    if (session) await session.abortTransaction();
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Error creating credit note'
    });
  } finally {
    if (session) session.endSession();
  }
});
