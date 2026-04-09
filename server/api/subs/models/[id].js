import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing a specific subs model
 *
 * Handles GET (retrieve), PUT (update), DELETE (remove) operations
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

  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Subs model ID is required'
    });
  }

  const db = getFirestore();
  // Use the correct collection name
  const subsModelRef = db.collection('subsModels').doc(id);

  // GET - Get a specific subs model
  if (event.method === 'GET') {
    try {
      const doc = await subsModelRef.get();

      if (!doc.exists) {
        console.error('Subs model not found with ID:', id);
        throw createError({
          statusCode: 404,
          message: 'Subs model not found'
        });
      }

      const subsModel = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this subs model
      if (subsModel.firmId !== firmIdStr) {
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      // Get transactions for this sub
      const subsCollection = db.collection('subs');

      // We'll collect all transactions from different queries
      let allTransactions = [];



      try {
        // APPROACH 1: Get transactions where this sub is the one making the transaction (subId)
        try {
          const byIdQuery = subsCollection
            .where('firmId', '==', firmIdStr)
            .where('subId', '==', doc.id);

          const byIdSnapshot = await byIdQuery.get();

          if (!byIdSnapshot.empty) {
            byIdSnapshot.forEach(doc => {
              const transactionData = doc.data();
              // Use custom transaction ID if available, otherwise use Firestore document ID
              const uniqueTransactionId = transactionData.id || doc.id;

              // Check if this transaction is already in our list to prevent duplicates
              const isDuplicate = allTransactions.some(t => t.id === uniqueTransactionId);

              if (!isDuplicate) {
                allTransactions.push({
                  ...transactionData,
                  id: uniqueTransactionId, // Use the unique transaction ID
                  firestoreDocId: doc.id, // Keep Firestore document ID separately
                  date: transactionData.date.toDate(),
                  createdAt: transactionData.createdAt?.toDate(),
                  updatedAt: transactionData.updatedAt?.toDate()
                });
              }
            });
          }
        } catch (error) {
          console.error('Error fetching by subId:', error.message);
        }

        // APPROACH 2: Get transactions where this sub is the one making the transaction (subName)
        try {
          const byNameQuery = subsCollection
            .where('firmId', '==', firmIdStr)
            .where('subName', '==', subsModel.name);

          const byNameSnapshot = await byNameQuery.get();

          if (!byNameSnapshot.empty) {
            byNameSnapshot.forEach(doc => {
              const transactionData = doc.data();
              // Use custom transaction ID if available, otherwise use Firestore document ID
              const uniqueTransactionId = transactionData.id || doc.id;

              // Check if this transaction is already in our list
              const isDuplicate = allTransactions.some(t => t.id === uniqueTransactionId);

              if (!isDuplicate) {
                allTransactions.push({
                  ...transactionData,
                  id: uniqueTransactionId, // Use the unique transaction ID
                  firestoreDocId: doc.id, // Keep Firestore document ID separately
                  date: transactionData.date.toDate(),
                  createdAt: transactionData.createdAt?.toDate(),
                  updatedAt: transactionData.updatedAt?.toDate()
                });
              }
            });
          }
        } catch (error) {
          console.error('Error fetching by subName:', error.message);
        }

        // APPROACH 3: Get transactions where this sub is the recipient (paidTo)
        try {
          const byPaidToQuery = subsCollection
            .where('firmId', '==', firmIdStr)
            .where('paidTo', '==', subsModel.name);

          const byPaidToSnapshot = await byPaidToQuery.get();

          if (!byPaidToSnapshot.empty) {
            byPaidToSnapshot.forEach(doc => {
              const transactionData = doc.data();
              // Use custom transaction ID if available, otherwise use Firestore document ID
              const uniqueTransactionId = transactionData.id || doc.id;

              // Check if this transaction is already in our list
              const isDuplicate = allTransactions.some(t => t.id === uniqueTransactionId);

              if (!isDuplicate) {
                allTransactions.push({
                  ...transactionData,
                  id: uniqueTransactionId, // Use the unique transaction ID
                  firestoreDocId: doc.id, // Keep Firestore document ID separately
                  date: transactionData.date.toDate(),
                  createdAt: transactionData.createdAt?.toDate(),
                  updatedAt: transactionData.updatedAt?.toDate()
                });
              }
            });
          }
        } catch (error) {
          console.error('Error fetching by paidTo:', error.message);
        }

        // Sort all transactions by date (newest first)
        allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

        // Transactions are now in allTransactions
      } catch (error) {
        console.error('Error fetching transactions:', error);
        // Continue without transactions if there's an error
      }

      // Make sure we have a transactions array, even if empty
      const finalTransactions = allTransactions || [];

      return {
        id: doc.id,
        ...subsModel,
        createdAt: subsModel.createdAt?.toDate(),
        updatedAt: subsModel.updatedAt?.toDate(),
        transactions: finalTransactions
      };
    } catch (error) {
      console.error('Error fetching subs model:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch subs model'
      });
    }
  }

  // PUT - Update a subs model
  if (event.method === 'PUT') {
    try {
      const doc = await subsModelRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Subs model not found'
        });
      }

      const existingSubsModel = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this subs model
      if (existingSubsModel.firmId !== firmIdStr) {
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      const body = await readBody(event);

      // Prepare update data
      const updateData = {
        updatedAt: Timestamp.now()
      };

      // Update fields if provided
      if (body.name) {
        // Check if the new name already exists
        if (body.name !== existingSubsModel.name) {
          const existingSubQuery = db.collection('subsModels')
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

          // Update all sub entries with the new name
          const batch = db.batch();
          const subsCollection = db.collection('subs');
          const subsQuery = subsCollection
            .where('firmId', '==', firmIdStr)
            .where('paidTo', '==', existingSubsModel.name);

          const subsSnapshot = await subsQuery.get();

          subsSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { paidTo: body.name });
          });

          await batch.commit();
        }

        updateData.name = body.name;
      }

      if (body.contactInfo) {
        updateData.contactInfo = {
          ...existingSubsModel.contactInfo,
          ...body.contactInfo
        };
      }

      if (body.balance !== undefined) {
        updateData.balance = Number(body.balance);
      }

      if (body.isActive !== undefined) {
        updateData.isActive = body.isActive;
      }

      // Update the document
      await subsModelRef.update(updateData);

      // Get the updated document
      const updatedDoc = await subsModelRef.get();
      const updatedSubsModel = updatedDoc.data();

      return {
        id: updatedDoc.id,
        ...updatedSubsModel,
        createdAt: updatedSubsModel.createdAt?.toDate(),
        updatedAt: updatedSubsModel.updatedAt?.toDate()
      };
    } catch (error) {
      console.error('Error updating subs model:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to update subs model'
      });
    }
  }

  // DELETE - Delete a subs model
  if (event.method === 'DELETE') {
    try {
      const doc = await subsModelRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Subs model not found'
        });
      }

      const subsModel = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this subs model
      if (subsModel.firmId !== firmIdStr) {
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      // Check if the sub has transactions
      const subsCollection = db.collection('subs');
      const subsQuery = subsCollection
        .where('firmId', '==', firmIdStr)
        .where('paidTo', '==', subsModel.name)
        .limit(1);

      const subsSnapshot = await subsQuery.get();

      if (!subsSnapshot.empty) {
        throw createError({
          statusCode: 400,
          message: 'Cannot delete a sub with transactions. Deactivate it instead.'
        });
      }

      // Delete the subs model
      await subsModelRef.delete();

      return {
        message: 'Subs model deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting subs model:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to delete subs model'
      });
    }
  }
});
