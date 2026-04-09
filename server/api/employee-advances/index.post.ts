import { defineEventHandler, createError, readBody } from 'h3';
import EmployeeAdvance from '../../models/EmployeeAdvance';
import { MasterRoll } from '../../models/MasterRoll';

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
    if (!body.masterRollId || !body.amount || !body.purpose ||
        !body.repaymentTerms || !body.repaymentTerms.installmentAmount ||
        !body.repaymentTerms.durationMonths) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields'
      });
    }

    // Verify employee exists
    const employee = await MasterRoll.findOne({
      _id: body.masterRollId,
      firmId
    });

    if (!employee) {
      throw createError({
        statusCode: 404,
        message: 'Employee not found'
      });
    }

    // Create new advance
    const newAdvance = new EmployeeAdvance({
      masterRollId: body.masterRollId,
      employeeName: employee.employeeName,
      amount: Number(body.amount),
      date: body.date ? new Date(body.date) : new Date(),
      purpose: body.purpose,
      repaymentTerms: {
        installmentAmount: Number(body.repaymentTerms.installmentAmount),
        durationMonths: Number(body.repaymentTerms.durationMonths)
      },
      status: body.status || 'pending',
      remainingBalance: Number(body.amount), // Initially, remaining balance equals the full amount
      firmId,
      userId
    });

    await newAdvance.save();

    return {
      success: true,
      advance: newAdvance
    };
  } catch (error: any) {
    console.error('Error in employee-advances POST API:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
