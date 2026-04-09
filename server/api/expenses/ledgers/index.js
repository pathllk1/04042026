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
  const method = event.node.req.method;
  
  // GET - Fetch all ledgers
  if (method === 'GET') {
    try {
      const queryParams = getQuery(event);
      
      // Build query based on filters
      const ledgersRef = db.collection(`firms/${firmId}/ledgers`);
      let ledgersQuery = ledgersRef;
      
      // Apply type filter if provided
      if (queryParams.type) {
        ledgersQuery = ledgersQuery.where('type', '==', queryParams.type);
      }
      
      // Execute query
      const snapshot = await ledgersQuery.orderBy('name').get();
      
      // Transform data
      const ledgers = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        ledgers.push({
          id: doc.id,
          ...data,
          // Convert Timestamp fields to ISO strings
          createdAt: data.createdAt?.toDate().toISOString() || null,
          updatedAt: data.updatedAt?.toDate().toISOString() || null,
          // Format transactions if present
          transactions: data.transactions ? data.transactions.map(tx => ({
            ...tx,
            date: tx.date?.toDate().toISOString() || null
          })) : []
        });
      });
      
      return ledgers;
    } catch (error) {
      console.error('Error fetching ledgers:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch ledgers',
        cause: error
      });
    }
  }
  
  // POST - Create a new ledger
  if (method === 'POST') {
    try {
      const body = await readBody(event);
      
      // Validate required fields
      if (!body.name || !body.type || body.openingBalance === undefined) {
        throw createError({
          statusCode: 400,
          message: 'Missing required fields: name, type, openingBalance'
        });
      }
      
      // Prepare ledger data
      const ledgerData = {
        name: body.name,
        type: body.type,
        openingBalance: Number(body.openingBalance),
        currentBalance: Number(body.openingBalance),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userId,
        transactions: []
      };
      
      // Add bank details if type is bank
      if (body.type === 'bank' && body.bankDetails) {
        ledgerData.bankDetails = {
          bankName: body.bankDetails.bankName || '',
          accountNumber: body.bankDetails.accountNumber || '',
          ifscCode: body.bankDetails.ifscCode || '',
          branch: body.bankDetails.branch || ''
        };
      }
      
      // Add document to Firestore
      const docRef = await db.collection(`firms/${firmId}/ledgers`).add(ledgerData);
      
      return {
        id: docRef.id,
        ...ledgerData,
        createdAt: ledgerData.createdAt.toDate().toISOString(),
        updatedAt: ledgerData.updatedAt.toDate().toISOString()
      };
    } catch (error) {
      console.error('Error creating ledger:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to create ledger',
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
