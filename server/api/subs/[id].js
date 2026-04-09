import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing a specific sub entry
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
      message: 'Sub ID is required'
    });
  }

  const db = getFirestore();
  const subRef = db.collection('subs').doc(id);

  // GET - Get a specific sub entry
  if (event.method === 'GET') {
    try {
      const doc = await subRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Sub entry not found'
        });
      }

      const sub = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this sub entry
      if (sub.firmId !== firmIdStr) {
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      return {
        id: doc.id,
        ...sub,
        date: sub.date.toDate(),
        createdAt: sub.createdAt?.toDate(),
        updatedAt: sub.updatedAt?.toDate()
      };
    } catch (error) {
      console.error('Error fetching sub entry:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch sub entry'
      });
    }
  }

  // PUT - Update a sub entry
  if (event.method === 'PUT') {
    try {
      const doc = await subRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Sub entry not found'
        });
      }

      const existingSub = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this sub entry
      if (existingSub.firmId !== firmIdStr) {
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      // Check if this is a linked sub entry (from an expense)
      if (existingSub.parentExpenseId) {
        throw createError({
          statusCode: 400,
          message: 'Cannot update a linked sub entry directly. Update the parent expense instead.'
        });
      }

      const body = await readBody(event);

      // Prepare update data
      const updateData = {
        updatedAt: Timestamp.now()
      };

      // Update fields if provided
      if (body.date) {
        updateData.date = Timestamp.fromDate(new Date(body.date));
      }

      if (body.paidTo) {
        updateData.paidTo = body.paidTo;
      }

      let amountDifference = 0;
      if (body.amount !== undefined) {
        const numericAmount = Number(body.amount);

        // Validate amount is not zero or invalid
        if (!numericAmount || numericAmount === 0) {
          throw createError({
            statusCode: 400,
            message: 'Amount cannot be zero or invalid'
          });
        }

        // Get the category (either from the body or the existing sub)
        const category = body.category || existingSub.category;

        // Ensure amount has the correct sign based on category
        // PAYMENT should be negative (red), RECEIPT should be positive (green)
        const newAmount = category === 'RECEIPT' ?
          Math.abs(numericAmount) :
          -Math.abs(numericAmount);

        amountDifference = newAmount - existingSub.amount;
        updateData.amount = newAmount;

        console.log('Amount update:', {
          originalAmount: existingSub.amount,
          newAmount: newAmount,
          category: category,
          difference: amountDifference
        });
      }

      if (body.category !== undefined) {
        updateData.category = body.category;

        // If category changed but amount didn't, we need to update the amount sign
        if (body.amount === undefined && body.category !== existingSub.category) {
          // Ensure amount has the correct sign based on the new category
          if (body.category === 'RECEIPT' && existingSub.amount < 0) {
            // If changing to RECEIPT and amount is negative, make it positive
            updateData.amount = Math.abs(existingSub.amount);
            amountDifference = updateData.amount - existingSub.amount;
          } else if (body.category === 'PAYMENT' && existingSub.amount > 0) {
            // If changing to PAYMENT and amount is positive, make it negative
            updateData.amount = -Math.abs(existingSub.amount);
            amountDifference = updateData.amount - existingSub.amount;
          }
        }
      }

      if (body.project !== undefined) {
        updateData.project = body.project;
      }

      if (body.description !== undefined) {
        updateData.description = body.description;
      }

      // Update the document
      await subRef.update(updateData);

      // If amount changed, update the sub's balance
      if (amountDifference !== 0) {
        const subsModelCollection = db.collection('subsModels');
        const subsQuery = subsModelCollection
          .where('firmId', '==', firmIdStr)
          .where('id', '==', existingSub.subId)
          .limit(1);

        // If we can't find by ID, try to find by name as a fallback
        let subsSnapshot = await subsQuery.get();
        if (subsSnapshot.empty) {
          const subsQueryByName = subsModelCollection
            .where('firmId', '==', firmIdStr)
            .where('name', '==', existingSub.subName)
            .limit(1);
          subsSnapshot = await subsQueryByName.get();
        }

        if (!subsSnapshot.empty) {
          const subsDoc = subsSnapshot.docs[0];
          const sub = subsDoc.data();

          // Update the balance (negative adjustment for payment increase, positive for decrease)
          await subsDoc.ref.update({
            balance: sub.balance + amountDifference,
            updatedAt: Timestamp.now()
          });
        }
      }

      // Get the updated document
      const updatedDoc = await subRef.get();
      const updatedSub = updatedDoc.data();

      return {
        id: updatedDoc.id,
        ...updatedSub,
        date: updatedSub.date.toDate(),
        createdAt: updatedSub.createdAt?.toDate(),
        updatedAt: updatedSub.updatedAt?.toDate()
      };
    } catch (error) {
      console.error('Error updating sub entry:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to update sub entry'
      });
    }
  }

  // DELETE - Delete a sub entry
  if (event.method === 'DELETE') {
    try {
      const doc = await subRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Sub entry not found'
        });
      }

      const sub = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this sub entry
      if (sub.firmId !== firmIdStr) {
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      // Check if this is a linked sub entry (from an expense)
      if (sub.parentExpenseId) {
        throw createError({
          statusCode: 400,
          message: 'Cannot delete a linked sub entry directly. Delete the parent expense instead.'
        });
      }

      // Update the sub's balance
      const subsModelCollection = db.collection('subsModels');
      const subsQuery = subsModelCollection
        .where('firmId', '==', firmIdStr)
        .where('id', '==', sub.subId)
        .limit(1);

      // If we can't find by ID, try to find by name as a fallback
      let subsSnapshot = await subsQuery.get();
      if (subsSnapshot.empty) {
        const subsQueryByName = subsModelCollection
          .where('firmId', '==', firmIdStr)
          .where('name', '==', sub.subName)
          .limit(1);
        subsSnapshot = await subsQueryByName.get();
      }

      if (!subsSnapshot.empty) {
        const subsDoc = subsSnapshot.docs[0];
        const subsModel = subsDoc.data();

        // Adjust the balance (add the amount back since we're deleting an expense)
        await subsDoc.ref.update({
          balance: subsModel.balance + sub.amount,
          updatedAt: Timestamp.now()
        });
      }

      // Delete the sub entry
      await subRef.delete();

      return {
        message: 'Sub entry deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting sub entry:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to delete sub entry'
      });
    }
  }
});
