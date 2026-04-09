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

          // Validate advance exists and has sufficient balance
          const advance = await EmployeeAdvance.findOne({
            _id: wage.selectedAdvanceId,
            firmId,
            remainingBalance: { $gte: wage.advance_recovery },
            status: { $in: ['approved', 'partially_recovered'] }
          }).session(session);

          if (!advance) {
            throw new Error(`Cannot recover ₹${wage.advance_recovery} from advance for ${wage.employeeName}. Insufficient balance or advance not found.`);
          }

          // Calculate new balance and status
          const newBalance = advance.remainingBalance - wage.advance_recovery;
          const newStatus = newBalance <= 0 ? 'fully_recovered' : 'partially_recovered';

          // Update advance atomically
          const updatedAdvance = await EmployeeAdvance.findByIdAndUpdate(
            wage.selectedAdvanceId,
            {
              remainingBalance: newBalance,
              status: newStatus
            },
            { new: true, session, runValidators: true }
          );

          if (!updatedAdvance) {
            throw new Error(`Failed to update advance balance for ${wage.employeeName}`);
          }

          // Create advance recovery record with complete audit trail
          const recovery = new AdvanceRecovery({
            advanceId: wage.selectedAdvanceId,
            employeeId: wage.masterRollId,
            employeeName: wage.employeeName,
            recoveryAmount: wage.advance_recovery,
            recoveryDate: new Date(wage.salary_month),
            recoveryMethod: 'salary_deduction',
            status: newStatus === 'fully_recovered' ? 'completed' : 'pending',
            reason: `Salary deduction for ${new Date(wage.salary_month).toLocaleDateString()}`,
            previousBalance: advance.remainingBalance,
            newBalance: newBalance,
            userId,
            firmId
          });

          await recovery.save({ session });

          // Add recovery ID to wage
          wage.advance_recovery_id = recovery._id;
        } else if (wage.advance_recovery === 0 && wage.advance_recovery_id) {
          // Wage has zero recovery but has recovery ID - this is invalid
          throw new Error(`Wage for ${wage.employeeName} has recovery ID but zero recovery amount. Please clear the recovery ID.`);
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