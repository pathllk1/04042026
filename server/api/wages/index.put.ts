import { Wage } from '../../models/Wage'
import { createError } from 'h3'
import EmployeeAdvance from '../../models/EmployeeAdvance'
import AdvanceRecovery from '../../models/AdvanceRecovery'
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
    const body = await readBody(event)
    const { wages, deleteWages, month } = body

    // Validate month format
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid month format (expected YYYY-MM)'
      })
    }

    // Parse month to get date range
    const [year, monthNum] = month.split('-')
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0) // Last day of month

    let updateCount = 0;
    let deleteCount = 0;
    let advanceRecoveryCount = 0;

    // Start a MongoDB session for transactions
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Handle updates if wages array exists
      if (wages && Array.isArray(wages)) {
        // Process each wage with advance recovery in a transaction
        for (const wageData of wages) {
          // Update the wage record
          const updatedWage = await Wage.findOneAndUpdate(
            {
              _id: wageData._id,
              firmId,
              salary_month: {
                $gte: startDate,
                $lte: endDate
              }
            },
            {
              $set: {
                ...wageData,
                salary_month: new Date(wageData.salary_month),
                paid_date: new Date(wageData.paid_date),
                updatedBy: userId,
                updatedAt: new Date()
              }
            },
            { new: true, session }
          );

          if (updatedWage) {
            updateCount++;

            // Process advance recovery if applicable
            if (wageData.advance_recovery > 0 && wageData.selectedAdvanceId) {
              // First, check if any existing recovery record exists for this wage (regardless of advance ID)
              const existingRecovery = await AdvanceRecovery.findOne({
                wageId: updatedWage._id
              }).session(session);

              // Get the new advance record
              const newAdvance = await EmployeeAdvance.findById(wageData.selectedAdvanceId).session(session);

              if (!newAdvance) {
                continue; // Skip if new advance not found
              }

              if (existingRecovery) {
                // If the advance ID has changed, we need to handle both the old and new advances
                if (existingRecovery.advanceId.toString() !== wageData.selectedAdvanceId) {
                  // Get the old advance record
                  const oldAdvance = await EmployeeAdvance.findById(existingRecovery.advanceId).session(session);

                  if (oldAdvance) {
                    // Restore the old advance's remaining balance by adding back the previous recovery amount
                    const oldAdvanceNewBalance = oldAdvance.remainingBalance + existingRecovery.recoveryAmount;
                    const oldAdvanceNewStatus = oldAdvanceNewBalance >= oldAdvance.amount ? 'paid' : 'partially_recovered';

                    await EmployeeAdvance.findByIdAndUpdate(
                      existingRecovery.advanceId,
                      {
                        remainingBalance: oldAdvanceNewBalance,
                        status: oldAdvanceNewStatus
                      },
                      { new: true, session }
                    );
                  }

                  // Update the recovery record with the new advance ID and amount
                  const updatedRecovery = await AdvanceRecovery.findByIdAndUpdate(
                    existingRecovery._id,
                    {
                      advanceId: wageData.selectedAdvanceId,
                      recoveryAmount: wageData.advance_recovery,
                      updatedAt: new Date()
                    },
                    { new: true, session }
                  );

                  // Update the wage record with the recovery ID
                  await Wage.findByIdAndUpdate(
                    updatedWage._id,
                    {
                      advance_recovery_id: updatedRecovery._id
                    },
                    { session }
                  );

                  // Update the new advance's remaining balance
                  const newRemainingBalance = Math.max(0, newAdvance.remainingBalance - wageData.advance_recovery);
                  const newStatus = newRemainingBalance === 0 ? 'fully_recovered' : 'partially_recovered';

                  await EmployeeAdvance.findByIdAndUpdate(
                    wageData.selectedAdvanceId,
                    {
                      remainingBalance: newRemainingBalance,
                      status: newStatus
                    },
                    { new: true, session }
                  );
                } else {
                  // Same advance, just update the amount if it changed
                  const recoveryDifference = wageData.advance_recovery - existingRecovery.recoveryAmount;

                  if (recoveryDifference !== 0) {
                    // Update the existing recovery record
                    await AdvanceRecovery.findByIdAndUpdate(
                      existingRecovery._id,
                      {
                        recoveryAmount: wageData.advance_recovery,
                        updatedAt: new Date()
                      },
                      { session }
                    );

                    // Only adjust the advance's remaining balance by the difference
                    const newRemainingBalance = Math.max(0, newAdvance.remainingBalance - recoveryDifference);
                    const newStatus = newRemainingBalance === 0 ? 'fully_recovered' : 'partially_recovered';

                    await EmployeeAdvance.findByIdAndUpdate(
                      wageData.selectedAdvanceId,
                      {
                        remainingBalance: newRemainingBalance,
                        status: newStatus
                      },
                      { new: true, session }
                    );
                  }
                }

                advanceRecoveryCount++;
              } else {
                // No existing recovery record, create a new one
                const recovery = new AdvanceRecovery({
                  advanceId: wageData.selectedAdvanceId,
                  employeeId: wageData.masterRollId,
                  employeeName: wageData.employeeName,
                  recoveryAmount: wageData.advance_recovery,
                  recoveryDate: new Date(wageData.paid_date),
                  wageId: updatedWage._id,
                  recoveryMethod: 'salary_deduction',
                  remarks: `Recovered from salary for ${new Date(wageData.salary_month).toLocaleDateString()}`,
                  userId,
                  firmId
                });

                const savedRecovery = await recovery.save({ session });

                // Update the wage record with the recovery ID
                await Wage.findByIdAndUpdate(
                  updatedWage._id,
                  {
                    advance_recovery_id: savedRecovery._id
                  },
                  { session }
                );

                // Update the advance remaining balance
                const newRemainingBalance = Math.max(0, newAdvance.remainingBalance - wageData.advance_recovery);
                const newStatus = newRemainingBalance === 0 ? 'fully_recovered' : 'partially_recovered';

                await EmployeeAdvance.findByIdAndUpdate(
                  wageData.selectedAdvanceId,
                  {
                    remainingBalance: newRemainingBalance,
                    status: newStatus
                  },
                  { new: true, session }
                );

                advanceRecoveryCount++;
              }
            }
          }
        }
      }

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

    // Handle deletions if deleteWages array exists
    if (deleteWages && Array.isArray(deleteWages)) {
      const deleteResult = await Wage.deleteMany({
        _id: { $in: deleteWages },
        firmId,
        salary_month: {
          $gte: startDate,
          $lte: endDate
        }
      })
      deleteCount = deleteResult.deletedCount
    }

    return {
      success: true,
      updateCount,
      deleteCount,
      advanceRecoveryCount,
      message: `Processed ${updateCount} updates, ${deleteCount} deletions, and ${advanceRecoveryCount} advance recoveries`
    }
  } catch (error: any) {
    console.error('Error processing wage records:', error)

    throw createError({
      statusCode: 500,
      message: `Error processing wage records: ${error.message}`
    })
  }
})
