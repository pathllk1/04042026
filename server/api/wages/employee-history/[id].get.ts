import { defineEventHandler, createError } from 'h3';
import { Wage } from '../../../models/Wage';

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

    // Get employee ID from URL parameter
    const employeeId = event.context.params?.id;

    if (!employeeId) {
      throw createError({
        statusCode: 400,
        message: 'Employee ID is required'
      });
    }

    // Find all wage records for this employee
    const wageHistory = await Wage.find({
      masterRollId: employeeId,
      firmId
    })
    .sort({ salary_month: -1 }) // Sort by salary month in descending order (newest first)
    .lean();

    return {
      success: true,
      wageHistory
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error fetching employee wage history'
    });
  }
});
