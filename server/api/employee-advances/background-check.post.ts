import { defineEventHandler, readBody, createError } from 'h3';
import EmployeeAdvance from '../../models/EmployeeAdvance';
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
    const { employeeIds } = body;

    if (!employeeIds || !Array.isArray(employeeIds)) {
      throw createError({
        statusCode: 400,
        message: 'Employee IDs array is required'
      });
    }

    // Limit the number of employees to prevent database overload
    if (employeeIds.length > 100) {
      throw createError({
        statusCode: 400,
        message: 'Too many employees requested. Maximum 100 employees per request.'
      });
    }

    console.log(`🔍 Background check API: Checking ${employeeIds.length} employees for firm ${firmId}`);
    console.log('📋 Sample employee IDs:', employeeIds.slice(0, 3));

    // Convert string IDs to ObjectIds for MongoDB query
    const objectIds = employeeIds.map(id => new mongoose.Types.ObjectId(id));
    console.log('🔄 Converted to ObjectIds:', objectIds.slice(0, 3));

    // Use a single aggregation query to efficiently get all advance data
    const advancesData = await EmployeeAdvance.aggregate([
      {
        $match: {
          masterRollId: { $in: objectIds },
          firmId: new mongoose.Types.ObjectId(firmId),
          remainingBalance: { $gt: 0 },
          status: { $in: ['pending', 'approved', 'partially_recovered'] }
        }
      },
      {
        $sort: { date: 1 } // Sort by date ascending to get oldest first
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
              repaymentTerms: '$repaymentTerms',
              status: '$status'
            }
          },
          totalOutstanding: { $sum: '$remainingBalance' },
          advanceCount: { $sum: 1 }
        }
      },
      {
        $project: {
          employeeId: '$_id',
          hasAdvances: true,
          totalOutstanding: 1,
          advanceCount: 1,
          // Only return the first advance for efficiency (oldest/priority advance)
          firstAdvance: { $arrayElemAt: ['$advances', 0] },
          _id: 0
        }
      }
    ]);

    // Create a comprehensive result map (convert ObjectIds back to strings)
    const advancesMap = {};
    advancesData.forEach(item => {
      const employeeIdString = item.employeeId.toString();
      advancesMap[employeeIdString] = {
        hasAdvances: true,
        totalOutstanding: item.totalOutstanding,
        advanceCount: item.advanceCount,
        firstAdvance: item.firstAdvance
      };
    });

    console.log(`📊 Found ${advancesData.length} employees with advances out of ${employeeIds.length} total`);
    if (advancesData.length > 0) {
      console.log('💰 Sample advance data:', advancesData.slice(0, 2));
    }

    // Create response for all requested employees (including those without advances)
    const result = employeeIds.map(employeeId => ({
      employeeId,
      hasAdvances: !!advancesMap[employeeId],
      totalOutstanding: advancesMap[employeeId]?.totalOutstanding || 0,
      advanceCount: advancesMap[employeeId]?.advanceCount || 0,
      firstAdvance: advancesMap[employeeId]?.firstAdvance || null
    }));

    return {
      success: true,
      processedAt: new Date().toISOString(),
      totalEmployees: employeeIds.length,
      employeesWithAdvances: advancesData.length,
      data: result
    };

  } catch (error: any) {
    console.error('Error in background advance check API:', error);
    
    // Handle database connection errors specifically
    if (error.name === 'MongooseError' || error.name === 'MongoError') {
      throw createError({
        statusCode: 503,
        message: 'Database service temporarily unavailable. Please try again later.'
      });
    }
    
    // Handle timeout errors
    if (error.name === 'MongoTimeoutError') {
      throw createError({
        statusCode: 504,
        message: 'Database query timeout. Please try again with fewer employees.'
      });
    }
    
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
