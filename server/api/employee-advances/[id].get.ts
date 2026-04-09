import { defineEventHandler, createError } from 'h3';
import EmployeeAdvance from '../../models/EmployeeAdvance';
import AdvanceRecovery from '../../models/AdvanceRecovery';

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

    // Get advance ID from URL
    const id = event.context.params?.id;

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'Advance ID is required'
      });
    }

    const advance = await EmployeeAdvance.findOne({
      _id: id,
      firmId
    });

    if (!advance) {
      throw createError({
        statusCode: 404,
        message: 'Advance not found'
      });
    }

    // Get recovery history for this advance
    const recoveries = await AdvanceRecovery.find({
      advanceId: id,
      firmId
    }).sort({ recoveryDate: -1 });

    return {
      advance,
      recoveries
    };
  } catch (error: any) {
    console.error('Error in employee-advances/[id] GET API:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
