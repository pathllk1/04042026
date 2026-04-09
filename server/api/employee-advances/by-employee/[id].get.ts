import { defineEventHandler, createError } from 'h3';
import EmployeeAdvance from '../../../models/EmployeeAdvance';

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

    // Get employee ID from URL
    const employeeId = event.context.params?.id;

    if (!employeeId) {
      throw createError({
        statusCode: 400,
        message: 'Employee ID is required'
      });
    }

    // Find all active advances for this employee
    const advances = await EmployeeAdvance.find({
      masterRollId: employeeId,
      firmId,
      remainingBalance: { $gt: 0 },
      status: { $in: ['pending', 'approved', 'partially_recovered'] }
    }).sort({ date: 1 });

    return {
      success: true,
      advances
    };
  } catch (error: any) {
    console.error('Error in employee-advances/by-employee/[id] GET API:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
