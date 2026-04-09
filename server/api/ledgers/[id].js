import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing a specific ledger
 *
 * Handles GET (retrieve), PUT (update), DELETE (remove) operations
 */
export default defineEventHandler(async (event) => {
  // Ensure user is authenticated
  const userId = event.context.userId;
  const firmId = event.context.user?.firmId;

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    });
  }

  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Ledger ID is required'
    });
  }

  const db = getFirestore();
  const ledgerRef = db.collection('ledgers').doc(id);

  // GET - Get a specific ledger
  if (event.method === 'GET') {
    try {
      const doc = await ledgerRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Ledger not found'
        });
      }

      const ledger = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this ledger
      if (ledger.firmId !== firmIdStr) {
        console.error('Access denied: ledger.firmId =', ledger.firmId, 'firmIdStr =', firmIdStr);
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      // Get transactions for this ledger
      let transactions = [];

      try {
        const transactionsCollection = db.collection('ledgerTransactions');

        // Simple query without ordering - no composite index needed
        const transactionsQuery = transactionsCollection
          .where('ledgerId', '==', id)
          .where('firmId', '==', firmIdStr);

        const transactionsSnapshot = await transactionsQuery.get();

        // Map the data and convert timestamps
        transactions = transactionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate(),
          createdAt: doc.data().createdAt?.toDate()
        }));

        // Sort in memory by createdAt timestamp (newest first)
        transactions.sort((a, b) => b.createdAt - a.createdAt);

        console.log(`[DEBUG] Fetched ${transactions.length} transactions for ledger ${id} (client-side sorted):`);
        console.log('[DEBUG] Transactions data:', JSON.stringify(transactions.map(t => ({
          id: t.id,
          date: t.date,
          createdAt: t.createdAt,
          description: t.description,
          amount: t.amount,
          type: t.type
        })), null, 2));

      } catch (error) {
        console.error('Error fetching transactions:', error);
        // Return empty transactions array instead of failing
        transactions = [];
      }

      return {
        id: doc.id,
        ...ledger,
        createdAt: ledger.createdAt?.toDate(),
        updatedAt: ledger.updatedAt?.toDate(),
        transactions
      };
    } catch (error) {
      console.error('Error fetching ledger:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch ledger'
      });
    }
  }

  // PUT - Update a ledger
  if (event.method === 'PUT') {
    try {
      const doc = await ledgerRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Ledger not found'
        });
      }

      const existingLedger = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this ledger
      if (existingLedger.firmId !== firmIdStr) {
        console.error('Access denied: existingLedger.firmId =', existingLedger.firmId, 'firmIdStr =', firmIdStr);
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      const body = await readBody(event);

      // Prepare update data
      const updateData = {
        updatedAt: Timestamp.now()
      };

      // Update fields if provided
      if (body.name) {
        updateData.name = body.name;
      }

      // Handle opening balance update
      if (body.openingBalance !== undefined && body.openingBalance !== existingLedger.openingBalance) {
        // Calculate the difference to adjust the current balance
        const balanceDifference = Number(body.openingBalance) - existingLedger.openingBalance;
        updateData.openingBalance = Number(body.openingBalance);
        updateData.currentBalance = existingLedger.currentBalance + balanceDifference;

        // Create a transaction for the adjustment
        const transactionsCollection = db.collection('ledgerTransactions');
        await transactionsCollection.add({
          ledgerId: id,
          expenseId: null,
          date: Timestamp.now(),
          description: 'Opening Balance Adjustment',
          amount: balanceDifference,
          type: balanceDifference >= 0 ? 'credit' : 'debit',
          balance: existingLedger.currentBalance + balanceDifference,
          firmId,
          createdAt: Timestamp.now()
        });
      }

      // Update bank details if provided and ledger type is bank
      if (existingLedger.type === 'bank' && body.bankDetails) {
        updateData.bankDetails = {
          ...existingLedger.bankDetails,
          ...body.bankDetails
        };
      }

      // Update the document
      await ledgerRef.update(updateData);

      // Get the updated document
      const updatedDoc = await ledgerRef.get();
      const updatedLedger = updatedDoc.data();

      return {
        id: updatedDoc.id,
        ...updatedLedger,
        createdAt: updatedLedger.createdAt?.toDate(),
        updatedAt: updatedLedger.updatedAt?.toDate()
      };
    } catch (error) {
      console.error('Error updating ledger:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to update ledger'
      });
    }
  }

  // DELETE - Delete a ledger
  if (event.method === 'DELETE') {
    try {
      const doc = await ledgerRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Ledger not found'
        });
      }

      const ledger = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this ledger
      if (ledger.firmId !== firmIdStr) {
        console.error('Access denied: ledger.firmId =', ledger.firmId, 'firmIdStr =', firmIdStr);
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      // Check if the ledger has transactions
      if (ledger.openingBalance !== ledger.currentBalance) {
        throw createError({
          statusCode: 400,
          message: 'Cannot delete a ledger with transactions'
        });
      }

      // Delete the ledger
      await ledgerRef.delete();

      // Delete associated transactions
      const transactionsCollection = db.collection('ledgerTransactions');
      const transactionsQuery = transactionsCollection
        .where('ledgerId', '==', id)
        .where('firmId', '==', firmId);

      const transactionsSnapshot = await transactionsQuery.get();

      // Delete transactions in batches
      const batch = db.batch();
      transactionsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      return {
        message: 'Ledger deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting ledger:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to delete ledger'
      });
    }
  }
});
