import { defineEventHandler, createError, getQuery } from 'h3';
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

    const query = getQuery(event);

    // Build filter object
    const filter: any = { firmId };

    // Add optional filters
    if (query.advanceId) {
      filter.advanceId = query.advanceId;
    }

    if (query.employeeId) {
      filter.employeeId = query.employeeId;
    }

    if (query.recoveryMethod) {
      filter.recoveryMethod = query.recoveryMethod;
    }

    // Date range filter
    if (query.startDate && query.endDate) {
      filter.recoveryDate = {
        $gte: new Date(query.startDate as string),
        $lte: new Date(query.endDate as string)
      };
    }

    // Get recoveries with pagination
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const recoveries = await AdvanceRecovery.find(filter)
      .sort({ recoveryDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AdvanceRecovery.countDocuments(filter);

    return {
      recoveries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error: any) {
    console.error('Error in employee-advances/recoveries GET API:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
