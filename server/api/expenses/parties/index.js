import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Expense Parties API (Firestore)
 *
 * - GET   /api/expenses/parties        → list parties (by firm), supports ?q=<name>
 * - POST  /api/expenses/parties        → create a party profile for expenses module
 *
 * Data shape stored in Firestore (collection: expenseParties):
 * {
 *   name: string,
 *   address?: string,
 *   gstin?: string,
 *   state?: string,
 *   pin?: string,
 *   pan?: string,
 *   contact?: string,
 *   bankDetails?: {
 *     bankName?: string,
 *     accountNumber?: string,
 *     ifscCode?: string,
 *     branch?: string,
 *     accountHolderName?: string
 *   },
 *   firmId: string,
 *   userId: string,
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp
 * }
 */
export default defineEventHandler(async (event) => {
  const userId = event.context.userId;
  const firmId = event.context.user?.firmId;

  if (!userId || !firmId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const db = getFirestore();
  const collection = db.collection('expenseParties');

  // GET - list by firm with optional name filter
  if (event.method === 'GET') {
    try {
      const firmIdStr = firmId.toString();
      const { q } = getQuery(event);

      // Query by firm
      const snapshot = await collection.where('firmId', '==', firmIdStr).orderBy('name').get();
      const results = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        results.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate().toISOString() || null,
          updatedAt: data.updatedAt?.toDate().toISOString() || null,
        });
      });

      // Optional client-side filter by name
      const filtered = typeof q === 'string' && q.trim()
        ? results.filter((p) => (p.name || '').toLowerCase().includes(q.toLowerCase()))
        : results;

      return filtered;
    } catch (error) {
      console.error('Error fetching expense parties:', error);
      throw createError({ statusCode: 500, message: 'Failed to fetch expense parties' });
    }
  }

  // POST - create
  if (event.method === 'POST') {
    try {
      const body = await readBody(event);

      // Basic validation
      if (!body || !body.name || typeof body.name !== 'string') {
        throw createError({ statusCode: 400, message: 'Missing required field: name' });
      }

      const now = Timestamp.now();
      const doc = {
        name: body.name.trim(),
        address: body.address?.toString() || '',
        gstin: body.gstin?.toString().toUpperCase() || '',
        state: body.state?.toString() || '',
        pin: body.pin?.toString() || '',
        pan: body.pan?.toString().toUpperCase() || '',
        contact: body.contact?.toString() || '',
        bankDetails: body.bankDetails ? {
          bankName: body.bankDetails.bankName || '',
          accountNumber: body.bankDetails.accountNumber || '',
          ifscCode: body.bankDetails.ifscCode?.toString().toUpperCase() || '',
          branch: body.bankDetails.branch || '',
          accountHolderName: body.bankDetails.accountHolderName || ''
        } : {},
        firmId: firmId.toString(),
        userId: userId.toString(),
        createdAt: now,
        updatedAt: now
      };

      // Prevent duplicate by name within firm
      const dupQuery = await collection
        .where('firmId', '==', doc.firmId)
        .where('name', '==', doc.name)
        .limit(1)
        .get();
      if (!dupQuery.empty) {
        throw createError({ statusCode: 409, message: 'A party with this name already exists' });
      }

      const ref = await collection.add(doc);
      return {
        id: ref.id,
        ...doc,
        createdAt: doc.createdAt.toDate().toISOString(),
        updatedAt: doc.updatedAt.toDate().toISOString()
      };
    } catch (error) {
      console.error('Error creating expense party:', error);
      // If error is already an h3 error, rethrow
      if (error?.statusCode) throw error;
      throw createError({ statusCode: 500, message: 'Failed to create expense party' });
    }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' });
});


