import { defineEventHandler, readBody, createError } from 'h3';
import { Wage } from '../../models/Wage';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    // Get user ID and firm ID from context (set by auth middleware)
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

    console.log(`🔍 Bulk history API: Fetching history for ${employeeIds.length} employees for firm ${firmId}`);
    console.log('📋 Sample employee IDs:', employeeIds.slice(0, 3));

    // Convert string IDs to ObjectIds for MongoDB query
    const objectIds = employeeIds.map(id => new mongoose.Types.ObjectId(id));
    console.log('🔄 Converted to ObjectIds:', objectIds.slice(0, 3));

    // Use aggregation to efficiently get the last wage record for each employee
    const lastWageRecords = await Wage.aggregate([
      {
        $match: {
          masterRollId: { $in: objectIds },
          firmId: new mongoose.Types.ObjectId(firmId)
        }
      },
      {
        $sort: { salary_month: -1 } // Sort by salary month descending (newest first)
      },
      {
        $group: {
          _id: '$masterRollId',
          lastWageRecord: { $first: '$$ROOT' } // Get the first (most recent) record for each employee
        }
      },
      {
        $project: {
          employeeId: '$_id',
          lastWageRecord: {
            _id: '$lastWageRecord._id',
            wage_Days: '$lastWageRecord.wage_Days',
            salary_month: '$lastWageRecord.salary_month',
            gross_salary: '$lastWageRecord.gross_salary',
            net_salary: '$lastWageRecord.net_salary',
            epf_deduction: '$lastWageRecord.epf_deduction',
            esic_deduction: '$lastWageRecord.esic_deduction',
            advance_recovery: '$lastWageRecord.advance_recovery',
            other_deduction: '$lastWageRecord.other_deduction',
            other_benefit: '$lastWageRecord.other_benefit'
          },
          _id: 0
        }
      }
    ]);

    // Create a map for quick lookup (convert ObjectIds back to strings)
    const wageHistoryMap = {};
    lastWageRecords.forEach(item => {
      const employeeIdString = item.employeeId.toString();
      wageHistoryMap[employeeIdString] = item.lastWageRecord;
    });

    console.log(`📊 Found ${lastWageRecords.length} employees with wage history out of ${employeeIds.length} total`);
    if (lastWageRecords.length > 0) {
      console.log('💰 Sample wage history records:', lastWageRecords.slice(0, 2));
    }

    // Create response for all requested employees
    const result = employeeIds.map(employeeId => ({
      employeeId,
      hasHistory: !!wageHistoryMap[employeeId],
      lastWageRecord: wageHistoryMap[employeeId] || null,
      lastWageDays: wageHistoryMap[employeeId]?.wage_Days || 26 // Default to 26 if no history
    }));

    console.log('📋 Sample result data:', result.slice(0, 3));

    return {
      success: true,
      processedAt: new Date().toISOString(),
      totalEmployees: employeeIds.length,
      employeesWithHistory: lastWageRecords.length,
      data: result
    };

  } catch (error: any) {
    console.error('Error in bulk employee history API:', error);
    
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
