// server/api/inventory/bills/cancel/[id].post.ts
import { defineEventHandler, createError, readBody } from 'h3';
import Bills from '../../../../models/inventory/Bills';
import StockReg from '../../../../models/inventory/StockReg';
import Stocks from '../../../../models/inventory/Stocks';
import mongoose from 'mongoose';
import { createCancellationLedgerTransaction } from '../../../../utils/ledgerTransactions';

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

    // Get the bill ID from the URL
    const id = event.context.params?.id;
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Missing bill ID'
      });
    }

    // Get the request body
    const body = await readBody(event);
    if (!body || !body.cancellationReason) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Cancellation reason is required'
      });
    }

    // Start a MongoDB session for transaction
    session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the bill to cancel
      const bill = await Bills.findOne({
        _id: id,
        firm: user.firmId
      }).session(session);

      if (!bill) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Not Found: Bill not found'
        });
      }

      // Check if bill is already cancelled
      if (bill.status === 'CANCELLED') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request: Bill is already cancelled'
        });
      }

      // Get stock registrations for this bill
      const stockRegs = await StockReg.find({
        billId: id,
        firm: user.firmId
      }).session(session);

      // Process stock adjustments based on bill type
      for (const stockReg of stockRegs) {
        if (stockReg.stockId) {
          let stockUpdate;

          // Determine stock adjustment based on bill type
          if (bill.btype === 'SALES' || bill.btype === 'DEBIT NOTE') {
            // For SALES and DEBIT NOTE, add items back to inventory
            stockUpdate = { $inc: { qty: stockReg.qty } };
          } else if (bill.btype === 'PURCHASE' || bill.btype === 'CREDIT NOTE') {
            // For PURCHASE and CREDIT NOTE, remove items from inventory
            stockUpdate = { $inc: { qty: -stockReg.qty } };
          }

          // Update stock
          if (stockUpdate) {
            await Stocks.findByIdAndUpdate(
              stockReg.stockId,
              stockUpdate,
              { session }
            );
          }
        }
      }

      // Update bill status to CANCELLED
      const cancelledBill = await Bills.findByIdAndUpdate(
        id,
        {
          status: 'CANCELLED',
          cancellationReason: body.cancellationReason,
          cancelledAt: new Date(),
          cancelledBy: user._id
        },
        { new: true, session }
      );

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
      session = null; // Set session to null after ending it

      try {
        // Create cancellation entry in ledger
        const ledgerResult = await createCancellationLedgerTransaction(cancelledBill, user._id.toString(), user.firmId.toString());
      } catch (ledgerError) {
        console.error('Error creating ledger transaction:', ledgerError);
        // Continue execution even if ledger transaction fails
        // We don't want to roll back the MongoDB transaction at this point
      }

      return {
        success: true,
        message: 'Bill cancelled successfully',
        bill: cancelledBill
      };
    } catch (error) {
      // Rollback the transaction on error
      if (session) {
        try {
          await session.abortTransaction();
          session.endSession();
        } catch (abortError) {
          console.error('Error aborting transaction:', abortError);
        }
      }
      throw error;
    }
  } catch (error: any) {
    // Ensure session is ended even if an error occurs
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (sessionError) {
        console.error('Error aborting transaction:', sessionError);
      }
    }

    console.error('Error cancelling bill:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal Server Error'
    });
  }
});
