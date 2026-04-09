import { defineEventHandler, createError } from 'h3';
import AdvanceRecovery from '../../../models/AdvanceRecovery';

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

    const recovery = await AdvanceRecovery.findOne({
      _id: id,
      firmId
    });

    if (!recovery) {
      throw createError({
        statusCode: 404,
        message: 'Recovery not found'
      });
    }

    return {
      recovery
    };
  } catch (error: any) {
    console.error('Error in employee-advances/recoveries/[id] GET API:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
