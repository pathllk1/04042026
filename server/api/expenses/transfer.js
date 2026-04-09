import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for transferring funds between ledgers
 *
 * Handles POST operations
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

  const db = getFirestore();
  const method = event.node.req.method;

  // POST - Create a new transfer
  if (method === 'POST') {
    try {
      const body = await readBody(event);

      // Validate required fields
      if (!body.date || !body.amount || body.amount <= 0 || !body.fromMode || !body.toMode) {
        throw createError({
          statusCode: 400,
          message: 'Missing or invalid required fields: date, amount, fromMode, toMode'
        });
      }

      // Validate from and to accounts
      if (body.fromMode === body.toMode) {
        if (body.fromMode === 'cash') {
          throw createError({
            statusCode: 400,
            message: 'Cannot transfer from cash to cash'
          });
        }

        if (body.fromMode === 'bank' && body.fromBankId === body.toBankId) {
          throw createError({
            statusCode: 400,
            message: 'Cannot transfer to the same bank account'
          });
        }
      }

      // Validate bank IDs if mode is bank
      if (body.fromMode === 'bank' && !body.fromBankId) {
        throw createError({
          statusCode: 400,
          message: 'Missing fromBankId for bank transfer'
        });
      }

      if (body.toMode === 'bank' && !body.toBankId) {
        throw createError({
          statusCode: 400,
          message: 'Missing toBankId for bank transfer'
        });
      }

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Get from ledger
      let fromLedgerRef;
      if (body.fromMode === 'cash') {
        const cashLedgersQuery = db.collection(`firms/${firmIdStr}/ledgers`).where('type', '==', 'cash');
        const cashLedgersSnapshot = await cashLedgersQuery.get();

        if (cashLedgersSnapshot.empty) {
          throw createError({
            statusCode: 404,
            message: 'Cash ledger not found'
          });
        }

        fromLedgerRef = cashLedgersSnapshot.docs[0].ref;
      } else {
        fromLedgerRef = db.collection(`firms/${firmIdStr}/ledgers`).doc(body.fromBankId);
      }

      // Get to ledger
      let toLedgerRef;
      if (body.toMode === 'cash') {
        const cashLedgersQuery = db.collection(`firms/${firmIdStr}/ledgers`).where('type', '==', 'cash');
        const cashLedgersSnapshot = await cashLedgersQuery.get();

        if (cashLedgersSnapshot.empty) {
          throw createError({
            statusCode: 404,
            message: 'Cash ledger not found'
          });
        }

        toLedgerRef = cashLedgersSnapshot.docs[0].ref;
      } else {
        toLedgerRef = db.collection(`firms/${firmIdStr}/ledgers`).doc(body.toBankId);
      }

      // Get ledger data
      const fromLedgerDoc = await fromLedgerRef.get();
      const toLedgerDoc = await toLedgerRef.get();

      if (!fromLedgerDoc.exists) {
        throw createError({
          statusCode: 404,
          message: 'From ledger not found'
        });
      }

      if (!toLedgerDoc.exists) {
        throw createError({
          statusCode: 404,
          message: 'To ledger not found'
        });
      }

      const fromLedger = fromLedgerDoc.data();
      const toLedger = toLedgerDoc.data();

      // Check if from ledger has sufficient balance
      if (fromLedger.currentBalance < body.amount) {
        throw createError({
          statusCode: 400,
          message: 'Insufficient balance in from ledger'
        });
      }

      // Create transfer expense
      const transferData = {
        date: Timestamp.fromDate(new Date(body.date)),
        amount: Number(body.amount),
        paidTo: `Transfer to ${toLedger.name}`,
        category: 'TRANSFER',
        description: body.description || `Transfer from ${fromLedger.name} to ${toLedger.name}`,
        project: body.project || '',
        isTransfer: true,
        transferDetails: {
          fromMode: body.fromMode,
          toMode: body.toMode,
          fromBankId: body.fromBankId || null,
          toBankId: body.toBankId || null,
          instrumentNo: body.instrumentNo || null
        },
        paymentMode: {
          type: body.fromMode,
          bankId: body.fromBankId || null,
          instrumentNo: body.instrumentNo || null
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userId.toString(),
        firmId: firmIdStr
      };

      // Add transfer to expenses collection
      const transferRef = await db.collection(`firms/${firmIdStr}/expenses`).add(transferData);

      // Update from ledger
      const fromLedgerNewBalance = fromLedger.currentBalance - body.amount;
      const fromLedgerTransactions = fromLedger.transactions || [];

      fromLedgerTransactions.push({
        date: transferData.date,
        description: `Transfer to ${toLedger.name}`,
        type: 'debit',
        amount: body.amount,
        balance: fromLedgerNewBalance,
        transferId: transferRef.id
      });

      await fromLedgerRef.update({
        currentBalance: fromLedgerNewBalance,
        transactions: fromLedgerTransactions,
        updatedAt: Timestamp.now(),
        updatedBy: userId.toString()
      });

      // Update to ledger
      const toLedgerNewBalance = toLedger.currentBalance + body.amount;
      const toLedgerTransactions = toLedger.transactions || [];

      toLedgerTransactions.push({
        date: transferData.date,
        description: `Transfer from ${fromLedger.name}`,
        type: 'credit',
        amount: body.amount,
        balance: toLedgerNewBalance,
        transferId: transferRef.id
      });

      await toLedgerRef.update({
        currentBalance: toLedgerNewBalance,
        transactions: toLedgerTransactions,
        updatedAt: Timestamp.now(),
        updatedBy: userId.toString()
      });

      return {
        id: transferRef.id,
        ...transferData,
        date: transferData.date.toDate().toISOString(),
        createdAt: transferData.createdAt.toDate().toISOString(),
        updatedAt: transferData.updatedAt.toDate().toISOString()
      };
    } catch (error) {
      console.error('Error creating transfer:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to create transfer',
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
