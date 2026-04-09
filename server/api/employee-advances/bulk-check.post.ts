import { defineEventHandler, readBody, createError } from 'h3';
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

    const body = await readBody(event);
    const { employeeIds } = body;

    if (!employeeIds || !Array.isArray(employeeIds)) {
      throw createError({
        statusCode: 400,
        message: 'Employee IDs array is required'
      });
    }

    // Limit the number of employees to check at once to prevent database overload
    if (employeeIds.length > 50) {
      throw createError({
        statusCode: 400,
        message: 'Too many employees requested. Maximum 50 employees per request.'
      });
    }

    // Use aggregation to efficiently get advance data for multiple employees
    const advancesData = await EmployeeAdvance.aggregate([
      {
        $match: {
          masterRollId: { $in: employeeIds },
          firmId,
          remainingBalance: { $gt: 0 },
          status: { $in: ['approved', 'paid', 'partially_recovered'] }
        }
      },
      {
        $group: {
          _id: '$masterRollId',
          advances: {
            $push: {
              _id: '$_id',
              amount: '$amount',
              remainingBalance: '$remainingBalance',
              date: '$date',
              repaymentTerms: '$repaymentTerms'
            }
          },
          hasAdvances: { $first: true }
        }
      },
      {
        $project: {
          employeeId: '$_id',
          hasAdvances: true,
          advances: { $slice: ['$advances', 1] }, // Only return the first advance for efficiency
          _id: 0
        }
      }
    ]);

    // Create a map for quick lookup
    const advancesMap = {};
    advancesData.forEach(item => {
      advancesMap[item.employeeId] = {
        hasAdvances: true,
        firstAdvance: item.advances[0] || null
      };
    });

    // Create response for all requested employees
    const result = employeeIds.map(employeeId => ({
      employeeId,
      hasAdvances: !!advancesMap[employeeId],
      firstAdvance: advancesMap[employeeId]?.firstAdvance || null
    }));

    return {
      success: true,
      data: result
    };

  } catch (error: any) {
    console.error('Error in bulk advance check API:', error);
    
    // Handle database connection errors specifically
    if (error.name === 'MongooseError' || error.name === 'MongoError') {
      throw createError({
        statusCode: 503,
        message: 'Database service temporarily unavailable. Please try again later.'
      });
    }
    
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
