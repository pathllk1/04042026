import { defineEventHandler, createError, readBody } from 'h3';
import AdvanceRecovery from '../../../models/AdvanceRecovery';
import EmployeeAdvance from '../../../models/EmployeeAdvance';
import { MasterRoll } from '../../../models/MasterRoll';
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

    const body = await readBody(event);

    // Validate required fields
    if (!body.advanceId || !body.recoveryAmount || !body.recoveryMethod) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields'
      });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Verify advance exists and belongs to the firm
      const advance = await EmployeeAdvance.findOne({
        _id: body.advanceId,
        firmId
      }).session(session);

      if (!advance) {
        throw createError({
          statusCode: 404,
          message: 'Advance not found'
        });
      }

      // Verify employee exists
      const employee = await MasterRoll.findOne({
        _id: advance.masterRollId,
        firmId
      }).session(session);

      if (!employee) {
        throw createError({
          statusCode: 404,
          message: 'Employee not found'
        });
      }

      // Validate recovery amount
      const recoveryAmount = Number(body.recoveryAmount);

      if (recoveryAmount <= 0) {
        throw createError({
          statusCode: 400,
          message: 'Recovery amount must be greater than zero'
        });
      }

      if (recoveryAmount > advance.remainingBalance) {
        throw createError({
          statusCode: 400,
          message: 'Recovery amount cannot exceed remaining balance'
        });
      }

      // Create new recovery record
      const newRecovery = new AdvanceRecovery({
        advanceId: body.advanceId,
        employeeId: advance.masterRollId,
        employeeName: advance.employeeName,
        recoveryAmount,
        recoveryDate: body.recoveryDate ? new Date(body.recoveryDate) : new Date(),
        wageId: body.wageId || null,
        recoveryMethod: body.recoveryMethod,
        remarks: body.remarks || '',
        firmId,
        userId
      });

      await newRecovery.save({ session });

      // Update advance remaining balance and status
      const newRemainingBalance = advance.remainingBalance - recoveryAmount;
      let newStatus = advance.status;

      if (newRemainingBalance === 0) {
        newStatus = 'fully_recovered';
      } else if (newRemainingBalance < advance.amount) {
        newStatus = 'partially_recovered';
      }

      await EmployeeAdvance.findByIdAndUpdate(
        body.advanceId,
        {
          $set: {
            remainingBalance: newRemainingBalance,
            status: newStatus
          }
        },
        { session }
      );

      // Commit the transaction
      await session.commitTransaction();

      return {
        success: true,
        recovery: newRecovery,
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
    console.error('Error in employee-advances/recoveries POST API:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
