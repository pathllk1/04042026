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
  const subsModelCollection = db.collection('subsModels');

  // GET - List all subs models for the user's firm
  if (event.method === 'GET') {
    try {
      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Helper function to process Firestore snapshot
      function processSnapshot(snapshot) {
        if (snapshot.empty) {
          return [];
        }

        // Transform data
        const subsModels = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          subsModels.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate().toISOString() || null,
            updatedAt: data.updatedAt?.toDate().toISOString() || null
          });
        });

        return subsModels;
      }

      // Get query parameters for filtering
      const query = getQuery(event);

      try {
        // First approach: Try with composite query (requires index)
        let subsQuery = subsModelCollection.where('firmId', '==', firmIdStr);

        // Apply active filter if provided
        if (query.isActive !== undefined) {
          const isActive = query.isActive === 'true';
          subsQuery = subsQuery.where('isActive', '==', isActive);
        }

        // Execute the query with ordering
        const snapshot = await subsQuery.orderBy('name').get();
        return processSnapshot(snapshot);
      } catch (indexError) {
        console.warn('Index error, falling back to client-side filtering:', indexError.message);

        // Fallback approach: Get all subs models for the firm and filter in memory
        const snapshot = await subsModelCollection.where('firmId', '==', firmIdStr).get();

        // Process the snapshot
        let subsModels = processSnapshot(snapshot);

        // Apply filters in memory
        if (query.isActive !== undefined) {
          const isActive = query.isActive === 'true';
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
        message: 'Failed to fetch subs models'
      });
    }
  }

  // POST - Create a new subs model
  if (event.method === 'POST') {
    try {
      const body = await readBody(event);

      // Validate required fields
      if (!body.name) {
        throw createError({
          statusCode: 400,
          message: 'Sub name is required'
        });
      }

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();
      const userIdStr = userId.toString();

      // Check if a sub with this name already exists
      const existingSubQuery = subsModelCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', body.name)
        .limit(1);

      const existingSubSnapshot = await existingSubQuery.get();

      if (!existingSubSnapshot.empty) {
        throw createError({
          statusCode: 400,
          message: 'A sub with this name already exists'
        });
      }

      // Create new subs model document
      const now = Timestamp.now();
      const newSubsModel = {
        name: body.name,
        contactInfo: {
          phone: body.contactInfo?.phone || null,
          email: body.contactInfo?.email || null,
          address: body.contactInfo?.address || null
        },
        balance: body.balance !== undefined ? Number(body.balance) : 0,
        firmId: firmIdStr,
        userId: userIdStr,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      // Save to Firestore
      const docRef = await subsModelCollection.add(newSubsModel);

      return {
        id: docRef.id,
        ...newSubsModel,
        createdAt: now.toDate(),
        updatedAt: now.toDate()
      };
    } catch (error) {
      console.error('Error creating subs model:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to create subs model'
      });
    }
  }
});
