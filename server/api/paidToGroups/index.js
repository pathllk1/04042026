import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing paid-to groups
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
  const paidToGroupsCollection = db.collection('paidToGroups');

  // GET - List all paid-to groups for the user's firm
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
        const paidToGroups = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          paidToGroups.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate().toISOString() || null,
            updatedAt: data.updatedAt?.toDate().toISOString() || null
          });
        });

        return paidToGroups;
      }

      // Get query parameters for filtering
      const query = getQuery(event);

      try {
        // Fetch paid-to groups for the firm

        // First approach: Try with composite query (requires index)
        let paidToGroupsQuery = paidToGroupsCollection.where('firmId', '==', firmIdStr);

        // Apply active filter if provided
        if (query.isActive !== undefined) {
          const isActive = query.isActive === 'true';
          paidToGroupsQuery = paidToGroupsQuery.where('isActive', '==', isActive);
          // Apply isActive filter
        }

        // Execute the query with ordering
        const snapshot = await paidToGroupsQuery.orderBy('name').get();
        // Process query results
        const result = processSnapshot(snapshot);
        return result;
      } catch (indexError) {
        // Index error, falling back to client-side filtering

        // Fallback approach: Get all paid-to groups for the firm and filter in memory
        const snapshot = await paidToGroupsCollection.where('firmId', '==', firmIdStr).get();
        // Process the snapshot
        let paidToGroups = processSnapshot(snapshot);

        // Apply filters in memory
        if (query.isActive !== undefined) {
          const isActive = query.isActive === 'true';
          paidToGroups = paidToGroups.filter(group => group.isActive === isActive);
          // Filter by isActive in memory
        }

        // Sort by name
        paidToGroups.sort((a, b) => a.name.localeCompare(b.name));

        return paidToGroups;
      }
    } catch (error) {
      // Error handling for GET request
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch paid-to groups'
      });
    }
  }

  // POST - Create a new paid-to group
  if (event.method === 'POST') {
    try {
      const body = await readBody(event);

      // Validate required fields
      if (!body.name) {
        throw createError({
          statusCode: 400,
          message: 'Group name is required'
        });
      }

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if a group with this name already exists
      const existingGroupQuery = paidToGroupsCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', body.name)
        .limit(1);

      const existingGroupSnapshot = await existingGroupQuery.get();

      if (!existingGroupSnapshot.empty) {
        throw createError({
          statusCode: 400,
          message: 'A group with this name already exists'
        });
      }

      // Create new paid-to group document
      const now = Timestamp.now();
      // Convert IDs to strings to avoid ObjectId issues
      const userIdStr = userId.toString();

      const newPaidToGroup = {
        name: body.name,
        description: body.description || null,
        firmId: firmIdStr,
        userId: userIdStr,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      // Save to Firestore
      const docRef = await paidToGroupsCollection.add(newPaidToGroup);

      return {
        id: docRef.id,
        ...newPaidToGroup,
        createdAt: now.toDate(),
        updatedAt: now.toDate()
      };
    } catch (error) {
      // Error handling for POST request
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to create paid-to group'
      });
    }
  }
});
