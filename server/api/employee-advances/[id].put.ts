import { defineEventHandler, createError, readBody } from 'h3';
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

    // Get advance ID from URL
    const id = event.context.params?.id;

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'Advance ID is required'
      });
    }

    const body = await readBody(event);

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

    // Prepare update data
    const updateData: any = {};

    // Only update allowed fields
    if (body.purpose) updateData.purpose = body.purpose;
    if (body.status) updateData.status = body.status;
    if (body.date) updateData.date = new Date(body.date);

    // Only allow updating amount and repayment terms if no recoveries have been made yet
    if (advance.amount === advance.remainingBalance) {
      // Allow updating amount
      if (body.amount) {
        updateData.amount = Number(body.amount);
        updateData.remainingBalance = Number(body.amount); // Update remaining balance too
      }

      // Allow updating repayment terms
      if (body.repaymentTerms) {
        if (body.repaymentTerms.installmentAmount) {
          updateData['repaymentTerms.installmentAmount'] = Number(body.repaymentTerms.installmentAmount);
        }
        if (body.repaymentTerms.durationMonths) {
          updateData['repaymentTerms.durationMonths'] = Number(body.repaymentTerms.durationMonths);
        }
      }
    }

    // Update the advance
    const updatedAdvance = await EmployeeAdvance.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    return {
      success: true,
      advance: updatedAdvance
    };
  } catch (error: any) {
    console.error('Error in employee-advances/[id] PUT API:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
