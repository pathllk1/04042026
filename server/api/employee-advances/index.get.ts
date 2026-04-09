import { defineEventHandler, createError, getQuery } from 'h3';
import EmployeeAdvance from '../../models/EmployeeAdvance';

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
    if (query.employeeId) {
      filter.masterRollId = query.employeeId;
    }

    if (query.status) {
      filter.status = query.status;
    }

    // Date range filter
    if (query.startDate && query.endDate) {
      filter.date = {
        $gte: new Date(query.startDate as string),
        $lte: new Date(query.endDate as string)
      };
    }

    // Get advances with pagination
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const advances = await EmployeeAdvance.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const total = await EmployeeAdvance.countDocuments(filter);

    return {
      advances,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error: any) {
    console.error('Error in employee-advances GET API:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
