import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing ledgers
 *
 * Handles GET (list), POST (create) operations
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
  const ledgersCollection = db.collection('ledgers');

  // GET - List all ledgers for the user's firm
  if (event.method === 'GET') {
    try {

      // Get query parameters for filtering
      const query = getQuery(event);
      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Helper function to process Firestore snapshot
      function processSnapshot(snapshot) {
        if (snapshot.empty) {
          return [];
        }

        // Transform data
        const ledgers = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          ledgers.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate().toISOString() || null,
            updatedAt: data.updatedAt?.toDate().toISOString() || null
          });
        });

        return ledgers;
      }

      try {
        // First approach: Try with composite query (requires index)
        let ledgersQuery = ledgersCollection.where('firmId', '==', firmIdStr);

        // Apply type filter if provided
        if (query.type) {
          ledgersQuery = ledgersQuery.where('type', '==', query.type);
        }

        // Execute the query with ordering
        const snapshot = await ledgersQuery.orderBy('name').get();
        return processSnapshot(snapshot);
      } catch (indexError) {
        console.warn('Index error, falling back to client-side filtering:', indexError.message);

        // Fallback approach: Get all ledgers for the firm and filter in memory
        const snapshot = await ledgersCollection.where('firmId', '==', firmIdStr).get();

        // Filter by type if needed
        let results = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (!query.type || data.type === query.type) {
            results.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate().toISOString() || null,
              updatedAt: data.updatedAt?.toDate().toISOString() || null
            });
          }
        });

        // Sort by name
        results.sort((a, b) => a.name.localeCompare(b.name));

        return results;
      }
    } catch (error) {
      console.error('Error fetching ledgers:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch ledgers'
      });
    }
  }

  // POST - Create a new ledger
  if (event.method === 'POST') {
    try {
      const body = await readBody(event);

      // Validate required fields
      if (!body.name || !body.type || body.openingBalance === undefined) {
        throw createError({
          statusCode: 400,
          message: 'Missing required fields'
        });
      }

      // Validate ledger type
      if (body.type !== 'cash' && body.type !== 'bank') {
        throw createError({
          statusCode: 400,
          message: 'Invalid ledger type'
        });
      }

      // Validate bank details if type is bank
      if (body.type === 'bank' && (!body.bankDetails || !body.bankDetails.accountNumber)) {
        throw createError({
          statusCode: 400,
          message: 'Bank account number is required for bank ledgers'
        });
      }

      // Check if a cash ledger already exists (only one cash ledger allowed)
      if (body.type === 'cash') {
        // Convert firmId to string to avoid ObjectId issues
        const firmIdStr = firmId.toString();

        const existingCashLedger = await ledgersCollection
          .where('firmId', '==', firmIdStr)
          .where('type', '==', 'cash')
          .limit(1)
          .get();

        if (!existingCashLedger.empty) {
          throw createError({
            statusCode: 400,
            message: 'A cash ledger already exists'
          });
        }
      }

      // Create new ledger document
      const now = Timestamp.now();
      // Convert IDs to strings to avoid ObjectId issues
      const firmIdStr = firmId.toString();
      const userIdStr = userId.toString();

      const newLedger = {
        name: body.name,
        type: body.type,
        openingBalance: Number(body.openingBalance),
        currentBalance: Number(body.openingBalance),
        bankDetails: body.type === 'bank' ? {
          accountNumber: body.bankDetails.accountNumber,
          ifscCode: body.bankDetails.ifscCode || null,
          branch: body.bankDetails.branch || null,
          bankName: body.bankDetails.bankName || null
        } : null,
        firmId: firmIdStr,
        userId: userIdStr,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      // Save to Firestore
      const docRef = await ledgersCollection.add(newLedger);

      // Create an opening balance transaction
      if (body.openingBalance !== 0) {
        const transactionsCollection = db.collection('ledgerTransactions');
        await transactionsCollection.add({
          ledgerId: docRef.id,
          expenseId: null,
          date: now,
          description: 'Opening Balance',
          amount: body.openingBalance,
          type: 'credit',
          balance: body.openingBalance,
          firmId: firmIdStr,
          createdAt: now
        });
      }

      return {
        id: docRef.id,
        ...newLedger,
        createdAt: now.toDate(),
        updatedAt: now.toDate()
      };
    } catch (error) {
      console.error('Error creating ledger:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to create ledger'
      });
    }
  }
});
