import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing subs
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
  const subsCollection = db.collection('subs');

  // GET - List all subs entries for the user's firm
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
        const subs = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          subs.push({
            id: doc.id,
            ...data,
            date: data.date.toDate(),
            createdAt: data.createdAt?.toDate() || null,
            updatedAt: data.updatedAt?.toDate() || null
          });
        });

        return subs;
      }

      // Get query parameters for filtering
      const query = getQuery(event);

      try {
        // First approach: Try with composite query (requires index)
        let subsQuery = subsCollection.where('firmId', '==', firmIdStr);

      // Apply filters if provided
      if (query.startDate && query.endDate) {
        subsQuery = subsQuery
          .where('date', '>=', new Date(query.startDate))
          .where('date', '<=', new Date(query.endDate));
      } else if (query.startDate) {
        subsQuery = subsQuery.where('date', '>=', new Date(query.startDate));
      } else if (query.endDate) {
        subsQuery = subsQuery.where('date', '<=', new Date(query.endDate));
      }

      if (query.paidTo) {
        subsQuery = subsQuery.where('paidTo', '==', query.paidTo);
      }

      if (query.category) {
        subsQuery = subsQuery.where('category', '==', query.category);
      }

      if (query.project) {
        subsQuery = subsQuery.where('project', '==', query.project);
      }

        // Execute the query
        const snapshot = await subsQuery.orderBy('date', 'desc').get();
        return processSnapshot(snapshot);
      } catch (indexError) {
        console.warn('Index error, falling back to client-side filtering:', indexError.message);

        // Fallback approach: Get all subs for the firm and filter in memory
        const snapshot = await subsCollection.where('firmId', '==', firmIdStr).get();

        // Process the snapshot
        let subs = processSnapshot(snapshot);

        // Apply filters in memory
        if (query.startDate && query.endDate) {
          const startDate = new Date(query.startDate).getTime();
          const endDate = new Date(query.endDate).getTime();
          subs = subs.filter(sub => {
            const subDate = new Date(sub.date).getTime();
            return subDate >= startDate && subDate <= endDate;
          });
        } else if (query.startDate) {
          const startDate = new Date(query.startDate).getTime();
          subs = subs.filter(sub => new Date(sub.date).getTime() >= startDate);
        } else if (query.endDate) {
          const endDate = new Date(query.endDate).getTime();
          subs = subs.filter(sub => new Date(sub.date).getTime() <= endDate);
        }

        if (query.paidTo) {
          subs = subs.filter(sub => sub.paidTo === query.paidTo);
        }

        if (query.category) {
          subs = subs.filter(sub => sub.category === query.category);
        }

        if (query.project) {
          subs = subs.filter(sub => sub.project === query.project);
        }

        // Sort by date descending
        subs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return subs;
      }
    } catch (error) {
      console.error('Error fetching subs:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch subs'
      });
    }
  }

  // POST - Create a new sub entry
  if (event.method === 'POST') {
    try {
      const body = await readBody(event);

      // Validate required fields
      if (!body.date || !body.paidTo || body.amount === undefined || !body.subId || !body.subName) {
        throw createError({
          statusCode: 400,
          message: 'Missing required fields'
        });
      }

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();
      const userIdStr = userId.toString();

      // Create new sub document
      const now = Timestamp.now();
      const newSub = {
        date: Timestamp.fromDate(new Date(body.date)),
        paidTo: body.paidTo,
        // Ensure amount has the correct sign based on category
        // PAYMENT should be negative (red), RECEIPT should be positive (green)
        amount: body.category === 'RECEIPT' ? Math.abs(Number(body.amount)) : -Math.abs(Number(body.amount)),
        category: body.category || 'PAYMENT',
        project: body.project || null,
        description: body.description || null,
        firmId: firmIdStr,
        userId: userIdStr,
        subId: body.subId, // ID of the sub making the transaction
        subName: body.subName, // Name of the sub making the transaction
        parentExpenseId: null, // This is a direct entry, not linked to an expense
        createdAt: now,
        updatedAt: now
      };

      // Save to Firestore
      const docRef = await subsCollection.add(newSub);

      // Update the sub's balance in subsModels
      const subsModelCollection = db.collection('subsModels');
      const subsQuery = subsModelCollection
        .where('firmId', '==', firmIdStr)
        .where('id', '==', body.subId)
        .limit(1);

      // If we can't find by ID, try to find by name as a fallback
      let subsSnapshot = await subsQuery.get();
      if (subsSnapshot.empty) {
        console.log('Sub not found by ID, trying to find by name...');
        const subsQueryByName = subsModelCollection
          .where('firmId', '==', firmIdStr)
          .where('name', '==', body.subName)
          .limit(1);
        subsSnapshot = await subsQueryByName.get();
      }

      if (!subsSnapshot.empty) {
        const subsDoc = subsSnapshot.docs[0];
        const sub = subsDoc.data();

        // Update the balance
        // For receipts (positive amount), add to the balance
        // For payments (negative amount), subtract from the balance
        await subsDoc.ref.update({
          balance: sub.balance + body.amount, // Add for receipts, subtract for payments
          updatedAt: now
        });
      } else {
        // We don't create a new sub model automatically anymore
        // The sub making the transaction should already exist
        console.error('Sub not found:', body.subId, body.subName);
        throw createError({
          statusCode: 400,
          message: 'Sub not found'
        });
      }

      return {
        id: docRef.id,
        ...newSub,
        date: new Date(body.date),
        createdAt: now.toDate(),
        updatedAt: now.toDate()
      };
    } catch (error) {
      console.error('Error creating sub entry:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to create sub entry'
      });
    }
  }
});
