import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initFirebase } from '../../../../utils/firebase';

/**
 * API endpoint for managing a specific subs transaction
 *
 * Handles PUT (update), DELETE (delete) operations
 */
export default defineEventHandler(async (event) => {
  // Initialize Firebase
  initFirebase();
  // Ensure user is authenticated
  const userId = event.context.userId;
  const firmId = event.context.user?.firmId;

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    });
  }

  const db = getFirestore();
  const method = event.node.req.method;
  const id = event.context.params.id;

  // PUT - Update subs transaction
  if (method === 'PUT') {
    try {
      const body = await readBody(event);

      // Validate required fields
      if (!body.date || !body.amount || !body.paidTo) {
        throw createError({
          statusCode: 400,
          message: 'Missing required fields: date, amount, paidTo'
        });
      }

      // Validate amount is not zero or invalid
      const numericAmount = Number(body.amount);
      if (!numericAmount || numericAmount === 0) {
        throw createError({
          statusCode: 400,
          message: 'Amount cannot be zero or invalid'
        });
      }

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      console.log('=== UPDATING TRANSACTION ===');
      console.log('Transaction ID:', id);
      console.log('Firm ID:', firmIdStr);
      console.log('Update data:', body);

      // Find the transaction in the subs collection (new method)
      const subsCollection = db.collection('subs');
      const transactionQuery = await subsCollection.where('id', '==', id).where('firmId', '==', firmIdStr).get();

      if (transactionQuery.empty) {
        throw createError({
          statusCode: 404,
          message: 'Transaction not found'
        });
      }

      const transactionDoc = transactionQuery.docs[0];
      const oldTransactionData = transactionDoc.data();
      console.log('Old transaction:', oldTransactionData);

      // Find the subs model document to update balance
      const subsModelsCollection = db.collection('subsModels');
      const subsQuery = await subsModelsCollection.where('firmId', '==', firmIdStr).get();

      if (subsQuery.empty) {
        throw createError({
          statusCode: 404,
          message: 'Subs model not found'
        });
      }

      const subsDoc = subsQuery.docs[0];

      // Use Firestore transaction for atomic updates to prevent race conditions
      const updatedTransaction = await db.runTransaction(async (transaction) => {
        // Re-read both documents within the transaction to ensure consistency
        const freshTransactionDoc = await transaction.get(transactionDoc.ref);
        const freshSubsDoc = await transaction.get(subsDoc.ref);

        if (!freshTransactionDoc.exists) {
          throw new Error('Transaction not found during update');
        }
        if (!freshSubsDoc.exists) {
          throw new Error('Subs model not found during transaction update');
        }

        const freshOldTransaction = freshTransactionDoc.data();
        const freshSubsData = freshSubsDoc.data();

        // Calculate balance adjustment with fresh data
        const amountDiff = numericAmount - Number(freshOldTransaction.amount);
        const newBalance = freshSubsData.balance + amountDiff;

        console.log('Transaction update balance calculation:', {
          oldAmount: freshOldTransaction.amount,
          newAmount: numericAmount,
          amountDiff: amountDiff,
          oldBalance: freshSubsData.balance,
          newBalance: newBalance
        });

        // Note: Negative balances are allowed in this system
        // Positive amounts = Receipts (money coming in)
        // Negative amounts = Payments (money going out)
        // Negative balances = Money owed to the sub-contractor
        console.log('Balance validation passed - negative balances are allowed');

        // Prepare updated transaction
        const updatedTx = {
          ...freshOldTransaction,
          date: Timestamp.fromDate(new Date(body.date)),
          amount: numericAmount,
          category: body.category || freshOldTransaction.category || 'PAYMENT',
          project: body.project || freshOldTransaction.project || '',
          description: body.description || freshOldTransaction.description || '',
          paidTo: body.paidTo,
          updatedAt: Timestamp.now(),
          updatedBy: userId.toString(),
          // Update balance tracking
          balanceBefore: freshSubsData.balance - amountDiff, // Original balance before this transaction
          balanceAfter: newBalance
        };

        // Update the transaction document in subs collection
        transaction.update(freshTransactionDoc.ref, updatedTx);

        // Update the subs model balance only (no longer storing transactions array)
        transaction.update(freshSubsDoc.ref, {
          balance: newBalance,
          updatedAt: Timestamp.now(),
          updatedBy: userId.toString()
        });

        return updatedTx;
      });

      console.log('Transaction updated successfully:', {
        transactionId: id,
        newAmount: updatedTransaction.amount,
        newBalance: updatedTransaction.balanceAfter
      });

      return {
        ...updatedTransaction,
        date: updatedTransaction.date.toDate().toISOString(),
        createdAt: updatedTransaction.createdAt.toDate().toISOString(),
        updatedAt: updatedTransaction.updatedAt.toDate().toISOString()
      };
    } catch (error) {
      console.error('=== TRANSACTION UPDATE ERROR ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Transaction ID:', id);
      console.error('Request body:', body);
      console.error('Full error:', error);

      throw createError({
        statusCode: 500,
        message: `Failed to update subs transaction: ${error.message}`,
        cause: error
      });
    }
  }

  // DELETE - Delete subs transaction
  if (method === 'DELETE') {
    try {
      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      console.log('=== DELETING TRANSACTION ===');
      console.log('Transaction ID:', id);
      console.log('Firm ID:', firmIdStr);

      // Find the transaction in the subs collection (new method)
      const subsCollection = db.collection('subs');
      const transactionQuery = await subsCollection.where('id', '==', id).where('firmId', '==', firmIdStr).get();

      if (transactionQuery.empty) {
        throw createError({
          statusCode: 404,
          message: 'Transaction not found'
        });
      }

      const transactionDoc = transactionQuery.docs[0];
      const transactionToDelete = transactionDoc.data();
      console.log('Transaction to delete:', transactionToDelete);

      // Find the subs model document to update balance
      const subsModelsCollection = db.collection('subsModels');
      const subsQuery = await subsModelsCollection.where('firmId', '==', firmIdStr).get();

      if (subsQuery.empty) {
        throw createError({
          statusCode: 404,
          message: 'Subs model not found'
        });
      }

      const subsDoc = subsQuery.docs[0];

      // Use Firestore transaction for atomic deletion
      await db.runTransaction(async (transaction) => {
        // Re-read both documents within the transaction to ensure consistency
        const freshTransactionDoc = await transaction.get(transactionDoc.ref);
        const freshSubsDoc = await transaction.get(subsDoc.ref);

        if (!freshTransactionDoc.exists) {
          throw new Error('Transaction not found during deletion');
        }
        if (!freshSubsDoc.exists) {
          throw new Error('Subs model not found during transaction deletion');
        }

        const freshTransactionData = freshTransactionDoc.data();
        const freshSubsData = freshSubsDoc.data();

        // Calculate new balance with fresh data - REVERSE the transaction
        // If transaction was a payment (-25), we ADD it back (+25)
        // If transaction was a receipt (+25), we SUBTRACT it back (-25)
        const newBalance = freshSubsData.balance - Number(freshTransactionData.amount);

        console.log('Transaction deletion balance calculation:', {
          transactionAmount: freshTransactionData.amount,
          oldBalance: freshSubsData.balance,
          newBalance: newBalance,
          transactionId: id
        });

        // Delete the transaction document from subs collection
        transaction.delete(freshTransactionDoc.ref);

        // Update the subs model balance only (no longer storing transactions array)
        transaction.update(freshSubsDoc.ref, {
          balance: newBalance,
          updatedAt: Timestamp.now(),
          updatedBy: userId.toString()
        });
      });

      console.log('Transaction deleted successfully:', {
        transactionId: id,
        deletedAmount: transactionToDelete.amount
      });

      return { success: true, message: 'Transaction deleted successfully' };
    } catch (error) {
      console.error('Error deleting subs transaction:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to delete subs transaction',
        cause: error
      });
    }
  }

  // Method not allowed
  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  });
});
