import { defineEventHandler, createError } from 'h3';
import AdvanceRecovery from '../../../models/AdvanceRecovery';
import EmployeeAdvance from '../../../models/EmployeeAdvance';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    // Get user and firm ID from context (set by auth middleware)
    const userId = event.context.userId;
    const firmId = event.context.user.firmId;

    if (!userId || !firmId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Get recovery ID from URL
    const id = event.context.params?.id;

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'Recovery ID is required'
      });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the recovery
      const recovery = await AdvanceRecovery.findOne({
        _id: id,
        firmId
      }).session(session);

      if (!recovery) {
        throw createError({
          statusCode: 404,
          message: 'Recovery not found'
        });
      }

      // Find the associated advance
      const advance = await EmployeeAdvance.findOne({
        _id: recovery.advanceId,
        firmId
      }).session(session);

      if (!advance) {
        throw createError({
          statusCode: 404,
          message: 'Associated advance not found'
        });
      }

      // Update advance remaining balance and status
      const newRemainingBalance = advance.remainingBalance + recovery.recoveryAmount;
      let newStatus = advance.status;

      if (newRemainingBalance === advance.amount) {
        // If this was the only recovery, set status back to 'paid'
        newStatus = 'paid';
      } else if (newRemainingBalance < advance.amount) {
        // If there are still other recoveries, keep as partially recovered
        newStatus = 'partially_recovered';
      }

      await EmployeeAdvance.findByIdAndUpdate(
        advance._id,
        {
          $set: {
            remainingBalance: newRemainingBalance,
            status: newStatus
          }
        },
        { session }
      );

      // Delete the recovery
      await AdvanceRecovery.findByIdAndDelete(id, { session });

      // Commit the transaction
      await session.commitTransaction();

      return {
        success: true,
        message: 'Recovery deleted successfully',
        remainingBalance: newRemainingBalance,
        status: newStatus
      };
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      // End session
      session.endSession();
    }
  } catch (error: any) {
    console.error('Error in employee-advances/recoveries/[id] DELETE API:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
