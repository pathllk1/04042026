import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing a specific ledger
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
  
  // Get ledger reference
  const ledgerRef = db.collection(`firms/${firmId}/ledgers`).doc(id);
  
  // GET - Fetch ledger by ID
  if (method === 'GET') {
    try {
      const doc = await ledgerRef.get();
      
      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Ledger not found'
        });
      }
      
      const data = doc.data();
      
      return {
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
      };
    } catch (error) {
      console.error('Error fetching ledger:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch ledger',
        cause: error
      });
    }
  }
  
  // PUT - Update ledger
  if (method === 'PUT') {
    try {
      const body = await readBody(event);
      
      // Validate required fields
      if (!body.name || !body.type || body.openingBalance === undefined) {
        throw createError({
          statusCode: 400,
          message: 'Missing required fields: name, type, openingBalance'
        });
      }
      
      // Get current ledger data
      const doc = await ledgerRef.get();
      
      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Ledger not found'
        });
      }
      
      const currentData = doc.data();
      
      // Calculate balance adjustment
      const openingBalanceDiff = Number(body.openingBalance) - currentData.openingBalance;
      const newCurrentBalance = currentData.currentBalance + openingBalanceDiff;
      
      // Prepare update data
      const updateData = {
        name: body.name,
        openingBalance: Number(body.openingBalance),
        currentBalance: newCurrentBalance,
        updatedAt: Timestamp.now(),
        updatedBy: userId
      };
      
      // Add bank details if type is bank
      if (body.type === 'bank' && body.bankDetails) {
        updateData.bankDetails = {
          bankName: body.bankDetails.bankName || '',
          accountNumber: body.bankDetails.accountNumber || '',
          ifscCode: body.bankDetails.ifscCode || '',
          branch: body.bankDetails.branch || ''
        };
      }
      
      // Update document in Firestore
      await ledgerRef.update(updateData);
      
      // Get updated document
      const updatedDoc = await ledgerRef.get();
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
      console.error('Error updating ledger:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to update ledger',
        cause: error
      });
    }
  }
  
  // DELETE - Delete ledger
  if (method === 'DELETE') {
    try {
      // Get current ledger data
      const doc = await ledgerRef.get();
      
      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Ledger not found'
        });
      }
      
      const data = doc.data();
      
      // Check if ledger can be deleted (only if opening balance equals current balance)
      if (data.openingBalance !== data.currentBalance) {
        throw createError({
          statusCode: 400,
          message: 'Cannot delete ledger with transactions. Current balance must equal opening balance.'
        });
      }
      
      // Delete document from Firestore
      await ledgerRef.delete();
      
      return { success: true, message: 'Ledger deleted successfully' };
    } catch (error) {
      console.error('Error deleting ledger:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to delete ledger',
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
