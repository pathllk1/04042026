import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing a specific paid-to group
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
      message: 'Paid-to group ID is required'
    });
  }

  const db = getFirestore();
  const paidToGroupRef = db.collection('paidToGroups').doc(id);

  // GET - Get a specific paid-to group
  if (event.method === 'GET') {
    try {
      const doc = await paidToGroupRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Paid-to group not found'
        });
      }

      const paidToGroup = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this paid-to group
      if (paidToGroup.firmId !== firmIdStr) {
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      return {
        id: doc.id,
        ...paidToGroup,
        createdAt: paidToGroup.createdAt?.toDate(),
        updatedAt: paidToGroup.updatedAt?.toDate()
      };
    } catch (error) {
      // Error handling for GET request
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch paid-to group'
      });
    }
  }

  // PUT - Update a paid-to group
  if (event.method === 'PUT') {
    try {
      const doc = await paidToGroupRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Paid-to group not found'
        });
      }

      const existingPaidToGroup = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this paid-to group
      if (existingPaidToGroup.firmId !== firmIdStr) {
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      const body = await readBody(event);

      // Prepare update data
      const updateData = {
        updatedAt: Timestamp.now(),
        updatedBy: userId.toString()
      };

      // Update fields if provided
      if (body.name) {
        // Check if the new name already exists
        if (body.name !== existingPaidToGroup.name) {
          const existingGroupQuery = db.collection('paidToGroups')
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

          // Update all expenses with the new group name
          const batch = db.batch();
          const expensesCollection = db.collection('expenses');
          const expensesQuery = expensesCollection
            .where('firmId', '==', firmIdStr)
            .where('paidToGroup', '==', existingPaidToGroup.name);

          const expensesSnapshot = await expensesQuery.get();

          expensesSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { paidToGroup: body.name });
          });

          await batch.commit();
        }

        updateData.name = body.name;
      }

      if (body.description !== undefined) {
        updateData.description = body.description;
      }

      if (body.isActive !== undefined) {
        updateData.isActive = body.isActive;
      }

      // Update the document
      await paidToGroupRef.update(updateData);

      // Get the updated document
      const updatedDoc = await paidToGroupRef.get();
      const updatedPaidToGroup = updatedDoc.data();

      return {
        id: updatedDoc.id,
        ...updatedPaidToGroup,
        createdAt: updatedPaidToGroup.createdAt?.toDate(),
        updatedAt: updatedPaidToGroup.updatedAt?.toDate()
      };
    } catch (error) {
      // Error handling for PUT request
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to update paid-to group'
      });
    }
  }

  // DELETE - Delete a paid-to group
  if (event.method === 'DELETE') {
    try {
      const doc = await paidToGroupRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Paid-to group not found'
        });
      }

      const paidToGroup = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this paid-to group
      if (paidToGroup.firmId !== firmIdStr) {
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      // Check if the group is in use
      const expensesCollection = db.collection('expenses');
      const expensesQuery = expensesCollection
        .where('firmId', '==', firmIdStr)
        .where('paidToGroup', '==', paidToGroup.name)
        .limit(1);

      const expensesSnapshot = await expensesQuery.get();

      if (!expensesSnapshot.empty) {
        throw createError({
          statusCode: 400,
          message: 'Cannot delete a group that is in use. Deactivate it instead.'
        });
      }

      // Delete the paid-to group
      await paidToGroupRef.delete();

      return {
        message: 'Paid-to group deleted successfully'
      };
    } catch (error) {
      // Error handling for DELETE request
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to delete paid-to group'
      });
    }
  }
});
