// server/api/inventory/bills/[id].delete.ts
import { defineEventHandler, createError } from 'h3';
import Bills from '../../../../models/inventory/Bills';
import StockReg from '../../../../models/inventory/StockReg';
import Stocks from '../../../../models/inventory/Stocks';
import mongoose from 'mongoose';
import { createDeletionLedgerTransactionMongo } from '../../../../utils/inventoryLedgerMongo';

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

    // Find the bill to delete with populated stock items
    const billToDelete = await Bills.findById(id)
      .populate('stockRegIds')
      .session(session);

    if (!billToDelete) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bill not found'
      });
    }

    // Check if the bill belongs to the user's firm
    if (billToDelete.firm.toString() !== user.firmId.toString()) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: You do not have permission to delete this bill'
      });
    }

    // Check if the bill is already cancelled
    if (billToDelete.status === 'CANCELLED') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Cannot delete a cancelled bill'
      });
    }

    console.log(`Deleting bill ${billToDelete.bno} of type ${billToDelete.btype}`);

    // Step 1: Revert stock quantities based on bill type
    if (billToDelete.stockRegIds && billToDelete.stockRegIds.length > 0) {
      for (const stockReg of billToDelete.stockRegIds) {
        console.log(`Reverting stock for item: ${stockReg.item}, qty: ${stockReg.qty}`);

        // Calculate quantity change based on bill type
        let qtyChange = 0;
        switch (billToDelete.btype) {
          case 'PURCHASE':
          case 'DEBIT NOTE':
            // These added stock, so we need to subtract when deleting
            qtyChange = -stockReg.qty;
            break;
          case 'SALES':
          case 'CREDIT NOTE':
            // These reduced stock, so we need to add back when deleting
            qtyChange = stockReg.qty;
            break;
          default:
            console.warn(`Unknown bill type: ${billToDelete.btype}`);
            continue;
        }

        // Find and update the stock record
        const stockFilter = {
          item: stockReg.item,
          hsn: stockReg.hsn,
          firm: user.firmId
        };

        // Add optional filters if they exist
        if (stockReg.pno) stockFilter.pno = stockReg.pno;
        if (stockReg.batch) stockFilter.batch = stockReg.batch;

        const stockUpdate = await Stocks.findOneAndUpdate(
          stockFilter,
          { $inc: { qty: qtyChange } },
          { session, new: true }
        );

        if (!stockUpdate) {
          console.warn(`Stock record not found for item: ${stockReg.item}`);
        } else {
          console.log(`Updated stock for ${stockReg.item}: new qty = ${stockUpdate.qty}`);
        }
      }
    }

    // Step 2: Delete associated StockReg entries
    if (billToDelete.stockRegIds && billToDelete.stockRegIds.length > 0) {
      const stockRegIds = billToDelete.stockRegIds.map(reg => reg._id || reg);
      await StockReg.deleteMany({ _id: { $in: stockRegIds } }).session(session);
      console.log(`Deleted ${stockRegIds.length} StockReg entries`);
    }

    // Step 3: Delete the bill
    await Bills.findByIdAndDelete(id).session(session);
    console.log(`Deleted bill ${billToDelete.bno}`);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    session = null; // Set session to null after ending it

    // Step 4: Update ledger balance (outside transaction to avoid blocking)
    try {
      await createDeletionLedgerTransactionMongo(billToDelete as any, user._id.toString(), user.firmId.toString());
      console.log('Ledger transaction created successfully');
    } catch (ledgerError) {
      console.error('Error creating ledger transaction:', ledgerError);
      // Continue execution even if ledger transaction fails
      // The bill deletion was successful, ledger is secondary
    }

    return {
      success: true,
      message: 'Bill deleted successfully',
      billNo: billToDelete.bno,
      billType: billToDelete.btype
    };

  } catch (error) {
    // Rollback transaction if it exists
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }

    console.error('Error deleting bill:', error);
    
    // Handle specific error types
    if (error.statusCode) {
      throw error; // Re-throw HTTP errors
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: `Internal Server Error: Failed to delete bill - ${error.message}`
    });
  }
});
