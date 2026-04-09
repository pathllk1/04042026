import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing subs models
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

  // GET - Fetch all subs models
  if (method === 'GET') {
    try {
      const queryParams = getQuery(event);

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Helper function to process Firestore snapshot
      function processSnapshot(snapshot) {
        if (snapshot.empty) {
          return [];
        }

        // Transform data
        const subsModels = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          subsModels.push({
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

        return subsModels;
      }

      try {
        // First approach: Try with composite query (requires index)
        const subsRef = db.collection(`firms/${firmIdStr}/subsModels`);
        let subsQuery = subsRef;

        // Apply isActive filter if provided
        if (queryParams.isActive !== undefined) {
          const isActive = queryParams.isActive === 'true';
          subsQuery = subsQuery.where('isActive', '==', isActive);
        }

        // Execute query with ordering
        const snapshot = await subsQuery.orderBy('name').get();
        return processSnapshot(snapshot);
      } catch (indexError) {
        console.warn('Index error, falling back to client-side filtering:', indexError.message);

        // Fallback approach: Get all subs models for the firm and filter in memory
        const subsRef = db.collection(`firms/${firmIdStr}/subsModels`);
        const snapshot = await subsRef.get();

        // Process the snapshot
        let subsModels = processSnapshot(snapshot);

        // Apply filters in memory
        if (queryParams.isActive !== undefined) {
          const isActive = queryParams.isActive === 'true';
          subsModels = subsModels.filter(model => model.isActive === isActive);
        }

        // Sort by name
        subsModels.sort((a, b) => a.name.localeCompare(b.name));

        return subsModels;

      }
    } catch (error) {
      console.error('Error fetching subs models:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch subs models',
        cause: error
      });
    }
  }

  // POST - Create a new subs model
  if (method === 'POST') {
    try {
      const body = await readBody(event);

      // Validate required fields
      if (!body.name) {
        throw createError({
          statusCode: 400,
          message: 'Missing required field: name'
        });
      }

      // Convert IDs to strings to avoid ObjectId issues
      const firmIdStr = firmId.toString();
      const userIdStr = userId.toString();

      // Prepare subs model data
      const subsData = {
        name: body.name,
        balance: Number(body.balance || 0),
        isActive: body.isActive !== false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userIdStr,
        transactions: []
      };

      // Add contact info if provided
      if (body.contactInfo) {
        subsData.contactInfo = {
          phone: body.contactInfo.phone || '',
          email: body.contactInfo.email || '',
          address: body.contactInfo.address || ''
        };
      }

      // Add document to Firestore
      const docRef = await db.collection(`firms/${firmIdStr}/subsModels`).add(subsData);

      return {
        id: docRef.id,
        ...subsData,
        createdAt: subsData.createdAt.toDate().toISOString(),
        updatedAt: subsData.updatedAt.toDate().toISOString()
      };
    } catch (error) {
      console.error('Error creating subs model:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to create subs model',
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
