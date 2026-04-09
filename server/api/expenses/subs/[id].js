import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing a specific subs model
 *
 * Handles GET (read), PUT (update), DELETE (delete) operations
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
  const id = event.context.params.id;

  // Convert firmId to string to avoid ObjectId issues
  const firmIdStr = firmId.toString();

  // Get subs model reference
  const subsRef = db.collection('subsModels').doc(id);

  // GET - Fetch subs model by ID
  if (method === 'GET') {
    try {
      console.log('=== FETCHING SUBS MODEL ===');
      console.log('Subs model ID:', id);
      console.log('Firm ID:', firmIdStr);
      console.log('Collection path: subsModels');

      const doc = await subsRef.get();
      console.log('Document exists:', doc.exists);

      if (!doc.exists) {
        // Debug: Check what subs models exist
        const allSubsSnapshot = await db.collection('subsModels').where('firmId', '==', firmIdStr).get();
        console.log('Available subs models for firm:', allSubsSnapshot.size);
        allSubsSnapshot.forEach(doc => {
          console.log('Available subs model:', {
            id: doc.id,
            name: doc.data().name,
            firmId: doc.data().firmId
          });
        });

        throw createError({
          statusCode: 404,
          message: 'Subs model not found'
        });
      }

      const data = doc.data();
      console.log('Subs model data:', {
        id: doc.id,
        name: data.name,
        firmId: data.firmId,
        transactionCount: data.transactions?.length || 0
      });

      // Verify the subs model belongs to the user's firm
      if (data.firmId !== firmIdStr) {
        console.log('Access denied - firmId mismatch:', {
          documentFirmId: data.firmId,
          userFirmId: firmIdStr
        });
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      const result = {
        id: doc.id,
        ...data,
        // Convert Timestamp fields to ISO strings
        createdAt: data.createdAt?.toDate().toISOString() || null,
        updatedAt: data.updatedAt?.toDate().toISOString() || null,
        // NOTE: Transactions are no longer returned from this endpoint
        // Use /api/subs/models/[id] to get transactions from the subs collection
        transactions: []
      };

      console.log('Returning subs model (transactions should be fetched from /api/subs/models/[id]):', doc.id);
      return result;
    } catch (error) {
      console.error('Error fetching subs model:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch subs model',
        cause: error
      });
    }
  }

  // PUT - Update subs model
  if (method === 'PUT') {
    try {
      const body = await readBody(event);

      // Validate required fields
      if (!body.name) {
        throw createError({
          statusCode: 400,
          message: 'Missing required field: name'
        });
      }

      // Prepare update data
      const updateData = {
        name: body.name,
        balance: Number(body.balance || 0),
        isActive: body.isActive !== false,
        updatedAt: Timestamp.now(),
        updatedBy: userId.toString()
      };

      // Add contact info if provided
      if (body.contactInfo) {
        updateData.contactInfo = {
          phone: body.contactInfo.phone || '',
          email: body.contactInfo.email || '',
          address: body.contactInfo.address || ''
        };
      }

      // Update document in Firestore
      await subsRef.update(updateData);

      // Get updated document
      const updatedDoc = await subsRef.get();
      const updatedData = updatedDoc.data();

      return {
        id: updatedDoc.id,
        ...updatedData,
        // Convert Timestamp fields to ISO strings
        createdAt: updatedData.createdAt?.toDate().toISOString() || null,
        updatedAt: updatedData.updatedAt?.toDate().toISOString() || null,
        // Format transactions if present
        transactions: updatedData.transactions ? updatedData.transactions.map(tx => ({
          ...tx,
          date: tx.date?.toDate().toISOString() || null
        })) : []
      };
    } catch (error) {
      console.error('Error updating subs model:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to update subs model',
        cause: error
      });
    }
  }

  // DELETE - Delete subs model
  if (method === 'DELETE') {
    try {
      // Get current subs model data
      const doc = await subsRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Subs model not found'
        });
      }

      // Delete document from Firestore
      await subsRef.delete();

      return { success: true, message: 'Subs model deleted successfully' };
    } catch (error) {
      console.error('Error deleting subs model:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to delete subs model',
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
