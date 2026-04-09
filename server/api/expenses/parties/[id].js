import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Expense Party by ID API
 *
 * - GET    /api/expenses/parties/:id  → fetch one
 * - PUT    /api/expenses/parties/:id  → update
 * - DELETE /api/expenses/parties/:id  → delete
 */
export default defineEventHandler(async (event) => {
  const userId = event.context.userId;
  const firmId = event.context.user?.firmId;
  if (!userId || !firmId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const id = event.context.params.id;
  const db = getFirestore();
  const collection = db.collection('expenseParties');

  // GET - fetch one
  if (event.method === 'GET') {
    try {
      const doc = await collection.doc(id).get();
      if (!doc.exists) {
        throw createError({ statusCode: 404, message: 'Party not found' });
      }
      const data = doc.data();
      if (data.firmId !== firmId.toString()) {
        throw createError({ statusCode: 403, message: 'Forbidden' });
      }
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString() || null,
        updatedAt: data.updatedAt?.toDate().toISOString() || null,
      };
    } catch (error) {
      if (error?.statusCode) throw error;
      throw createError({ statusCode: 500, message: 'Failed to fetch party' });
    }
  }

  // PUT - update
  if (event.method === 'PUT') {
    try {
      const body = await readBody(event);
      const docRef = collection.doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw createError({ statusCode: 404, message: 'Party not found' });
      }
      const existing = snap.data();
      if (existing.firmId !== firmId.toString()) {
        throw createError({ statusCode: 403, message: 'Forbidden' });
      }

      const payload = {
        name: body.name?.toString().trim() || existing.name,
        address: body.address?.toString() ?? existing.address ?? '',
        gstin: body.gstin?.toString().toUpperCase() ?? existing.gstin ?? '',
        state: body.state?.toString() ?? existing.state ?? '',
        pin: body.pin?.toString() ?? existing.pin ?? '',
        pan: body.pan?.toString().toUpperCase() ?? existing.pan ?? '',
        contact: body.contact?.toString() ?? existing.contact ?? '',
        bankDetails: {
          bankName: body.bankDetails?.bankName ?? existing.bankDetails?.bankName ?? '',
          accountNumber: body.bankDetails?.accountNumber ?? existing.bankDetails?.accountNumber ?? '',
          ifscCode: body.bankDetails?.ifscCode?.toString().toUpperCase() ?? existing.bankDetails?.ifscCode ?? '',
          branch: body.bankDetails?.branch ?? existing.bankDetails?.branch ?? '',
          accountHolderName: body.bankDetails?.accountHolderName ?? existing.bankDetails?.accountHolderName ?? ''
        },
        updatedAt: Timestamp.now(),
      };

      await docRef.update(payload);
      const updated = await docRef.get();
      const data = updated.data();
      return {
        id: updated.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString() || null,
        updatedAt: data.updatedAt?.toDate().toISOString() || null,
      };
    } catch (error) {
      if (error?.statusCode) throw error;
      throw createError({ statusCode: 500, message: 'Failed to update party' });
    }
  }

  // DELETE - delete
  if (event.method === 'DELETE') {
    try {
      const docRef = collection.doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw createError({ statusCode: 404, message: 'Party not found' });
      }
      const existing = snap.data();
      if (existing.firmId !== firmId.toString()) {
        throw createError({ statusCode: 403, message: 'Forbidden' });
      }
      await docRef.delete();
      return { success: true };
    } catch (error) {
      if (error?.statusCode) throw error;
      throw createError({ statusCode: 500, message: 'Failed to delete party' });
    }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' });
});


