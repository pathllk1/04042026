import { Wage } from '../../models/Wage'
import { MasterRoll } from '../../models/MasterRoll'
import EmployeeAdvance from '../../models/EmployeeAdvance'
import AdvanceRecovery from '../../models/AdvanceRecovery'
import { createError } from 'h3'
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
  // Get user ID from context (set by auth middleware)
  const userId = event.context.userId
  const firmId = event.context.user.firmId

  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  try {
    // Get request body
    const { wages } = await readBody(event)

    if (!wages || !Array.isArray(wages) || wages.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Invalid wage data'
      })
    }

    // Add userId to each wage record
    const wagesWithUserId = wages.map(wage => ({
      ...wage,
      userId,
      firmId
    }))

    // Start a MongoDB session for transactions
    const session = await mongoose.startSession();
    let savedWages;
    let pDayWageUpdatesCount = 0;

    try {
      session.startTransaction();

      // Process each wage with advance recovery in a transaction
      const processedWages = [];

      for (const wage of wagesWithUserId) {
        // Process advance recovery if applicable
        if (wage.advance_recovery > 0 && wage.selectedAdvanceId) {
          // Validate recovery amount first
          if (wage.advance_recovery < 0) {
            throw new Error(`Invalid negative advance recovery amount: ${wage.advance_recovery} for employee ${wage.employeeName}`);
          }

          // Use atomic findOneAndUpdate with validation to prevent race conditions
          const updatedAdvance = await EmployeeAdvance.findOneAndUpdate(
            {
              _id: wage.selectedAdvanceId,
              remainingBalance: { $gte: wage.advance_recovery }, // Ensure sufficient balance
              status: { $in: ['active', 'partially_recovered'] } // Only process active advances
            },
            {
              $inc: { remainingBalance: -wage.advance_recovery }, // Atomic decrement
              $set: {
                status: {
                  $cond: {
                    if: { $lte: [{ $subtract: ['$remainingBalance', wage.advance_recovery] }, 0] },
                    then: 'fully_recovered',
                    else: 'partially_recovered'
                  }
                }
              }
            },
            {
              new: true,
              session,
              runValidators: true
            }
          );

          if (!updatedAdvance) {
            throw new Error(`Cannot process advance recovery of ₹${wage.advance_recovery} for employee ${wage.employeeName}. Insufficient advance balance or advance not found.`);
          }

          // Create advance recovery record only after successful balance update
          const recovery = new AdvanceRecovery({
            advanceId: wage.selectedAdvanceId,
            employeeId: wage.masterRollId,
            employeeName: wage.employeeName,
            recoveryAmount: wage.advance_recovery,
            recoveryDate: new Date(),
            recoveryMethod: 'salary_deduction',
            remarks: `Recovered from salary for ${new Date(wage.salary_month).toLocaleDateString()}`,
            userId,
            firmId,
            previousBalance: updatedAdvance.remainingBalance + wage.advance_recovery,
            newBalance: updatedAdvance.remainingBalance
          });

          await recovery.save({ session });

          // Add recovery ID to wage
          wage.advance_recovery_id = recovery._id;
        }

        processedWages.push(wage);
      }

      // Save wages to database
      savedWages = await Wage.insertMany(processedWages, { session });

      // Update recovery records with wage IDs
      for (let i = 0; i < savedWages.length; i++) {
        const wage = savedWages[i];
        if (wage.advance_recovery_id) {
          await AdvanceRecovery.findByIdAndUpdate(
            wage.advance_recovery_id,
            { wageId: wage._id },
            { session }
          );
        }
      }

      // Update pDayWage in MasterRoll for each employee
      const updatePromises = wages.map(async wage => {
        // Check if pDayWage has changed
        if (wage.pDayWageChanged) {
          const updatedEmployee = await MasterRoll.findByIdAndUpdate(
            wage.masterRollId,
            { pDayWage: Number(wage.pDayWage) },
            { new: true, session }
          );

          if (updatedEmployee) {
            pDayWageUpdatesCount++;
          }

          return updatedEmployee;
        }
        return null;
      });

      await Promise.all(updatePromises);

      // Commit the transaction
      await session.commitTransaction();
    } catch (error) {
      // Abort the transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      // End the session
      session.endSession();
    }

    return {
      success: true,
      message: 'Wages saved successfully',
      count: savedWages.length,
      updatedMasterRoll: pDayWageUpdatesCount,
      savedWages: savedWages.map(wage => ({
        _id: wage._id.toString(),
        employeeName: wage.employeeName,
        net_salary: wage.net_salary,
        paid_date: wage.paid_date,
        salary_month: wage.salary_month,
        cheque_no: wage.cheque_no || '',
        project: wage.project || 'KIR_NON_CORE',
        paid_from_bank_ac: wage.paid_from_bank_ac
      }))
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `Error saving wages: ${error.message}`
    })
  }
})