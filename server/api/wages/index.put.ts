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

            // Get existing recovery record if any
            const existingRecovery = await AdvanceRecovery.findOne({
              wageId: updatedWage._id
            }).session(session);

            // CASE 1: Recovery removed (set to 0)
            if (wageData.advance_recovery === 0 && existingRecovery) {
              // Restore advance balance
              const advance = await EmployeeAdvance.findById(existingRecovery.advanceId).session(session);

              if (advance) {
                const newBalance = advance.remainingBalance + existingRecovery.recoveryAmount;
                const newStatus = newBalance >= advance.amount ? 'approved' : 'partially_recovered';

                await EmployeeAdvance.findByIdAndUpdate(
                  existingRecovery.advanceId,
                  {
                    remainingBalance: newBalance,
                    status: newStatus
                  },
                  { session }
                );
              }

              // Mark recovery as reversed
              await AdvanceRecovery.findByIdAndUpdate(
                existingRecovery._id,
                {
                  status: 'reversed',
                  reason: `Reversed - recovery removed from wage on ${new Date().toLocaleDateString()}`
                },
                { session }
              );

              // Clear recovery ID from wage
              await Wage.findByIdAndUpdate(
                updatedWage._id,
                { advance_recovery_id: null },
                { session }
              );

              advanceRecoveryCount++;
            }
            // CASE 2: Recovery exists and needs update
            else if (wageData.advance_recovery > 0 && wageData.selectedAdvanceId) {
              // Validate new advance exists
              const newAdvance = await EmployeeAdvance.findOne({
                _id: wageData.selectedAdvanceId,
                firmId,
                status: { $in: ['approved', 'partially_recovered'] }
              }).session(session);

              if (!newAdvance) {
                throw new Error(`Advance not found or not available for recovery for ${wageData.employeeName}`);
              }

              if (existingRecovery) {
                // CASE 2A: Advance ID changed
                if (existingRecovery.advanceId.toString() !== wageData.selectedAdvanceId) {
                  // Get old advance
                  const oldAdvance = await EmployeeAdvance.findById(existingRecovery.advanceId).session(session);

                  if (oldAdvance) {
                    // Restore old advance balance
                    const oldAdvanceNewBalance = oldAdvance.remainingBalance + existingRecovery.recoveryAmount;
                    const oldAdvanceNewStatus = oldAdvanceNewBalance >= oldAdvance.amount ? 'approved' : 'partially_recovered';

                    await EmployeeAdvance.findByIdAndUpdate(
                      existingRecovery.advanceId,
                      {
                        remainingBalance: oldAdvanceNewBalance,
                        status: oldAdvanceNewStatus
                      },
                      { session }
                    );
                  }

                  // Delete old recovery record
                  await AdvanceRecovery.findByIdAndDelete(existingRecovery._id, { session });

                  // Create new recovery record for new advance
                  const newBalance = newAdvance.remainingBalance - wageData.advance_recovery;
                  const newStatus = newBalance <= 0 ? 'fully_recovered' : 'partially_recovered';

                  if (newAdvance.remainingBalance < wageData.advance_recovery) {
                    throw new Error(`Cannot recover ₹${wageData.advance_recovery} from advance. Insufficient balance of ₹${newAdvance.remainingBalance}.`);
                  }

                  const newRecovery = new AdvanceRecovery({
                    advanceId: wageData.selectedAdvanceId,
                    employeeId: wageData.masterRollId,
                    employeeName: wageData.employeeName,
                    recoveryAmount: wageData.advance_recovery,
                    recoveryDate: new Date(wageData.salary_month),
                    recoveryMethod: 'salary_deduction',
                    status: newStatus === 'fully_recovered' ? 'completed' : 'pending',
                    reason: `Salary deduction for ${new Date(wageData.salary_month).toLocaleDateString()} (changed from advance ${existingRecovery.advanceId})`,
                    previousBalance: newAdvance.remainingBalance,
                    newBalance: newBalance,
                    wageId: updatedWage._id,
                    userId,
                    firmId
                  });

                  const savedRecovery = await newRecovery.save({ session });

                  // Update wage with new recovery ID
                  await Wage.findByIdAndUpdate(
                    updatedWage._id,
                    { advance_recovery_id: savedRecovery._id },
                    { session }
                  );

                  // Update new advance balance
                  await EmployeeAdvance.findByIdAndUpdate(
                    wageData.selectedAdvanceId,
                    {
                      remainingBalance: newBalance,
                      status: newStatus
                    },
                    { session }
                  );

                  advanceRecoveryCount++;
                }
                // CASE 2B: Same advance, amount changed
                else {
                  const amountDifference = wageData.advance_recovery - existingRecovery.recoveryAmount;

                  if (amountDifference !== 0) {
                    // Validate new amount doesn't exceed remaining balance
                    const totalAvailable = newAdvance.remainingBalance + existingRecovery.recoveryAmount;

                    if (wageData.advance_recovery > totalAvailable) {
                      throw new Error(`Cannot change recovery to ₹${wageData.advance_recovery}. Available balance: ₹${totalAvailable}.`);
                    }

                    const newBalance = totalAvailable - wageData.advance_recovery;
                    const newStatus = newBalance <= 0 ? 'fully_recovered' : 'partially_recovered';

                    // Update recovery record
                    await AdvanceRecovery.findByIdAndUpdate(
                      existingRecovery._id,
                      {
                        recoveryAmount: wageData.advance_recovery,
                        status: newStatus === 'fully_recovered' ? 'completed' : 'pending',
                        previousBalance: totalAvailable,
                        newBalance: newBalance,
                        reason: `Amount changed from ₹${existingRecovery.recoveryAmount} to ₹${wageData.advance_recovery}`
                      },
                      { session }
                    );

                    // Update advance balance
                    await EmployeeAdvance.findByIdAndUpdate(
                      wageData.selectedAdvanceId,
                      {
                        remainingBalance: newBalance,
                        status: newStatus
                      },
                      { session }
                    );

                    advanceRecoveryCount++;
                  }
                }
              }
              // CASE 2C: No existing recovery, create new one
              else {
                const newBalance = newAdvance.remainingBalance - wageData.advance_recovery;
                const newStatus = newBalance <= 0 ? 'fully_recovered' : 'partially_recovered';

                if (newAdvance.remainingBalance < wageData.advance_recovery) {
                  throw new Error(`Cannot recover ₹${wageData.advance_recovery} from advance. Insufficient balance of ₹${newAdvance.remainingBalance}.`);
                }

                const recovery = new AdvanceRecovery({
                  advanceId: wageData.selectedAdvanceId,
                  employeeId: wageData.masterRollId,
                  employeeName: wageData.employeeName,
                  recoveryAmount: wageData.advance_recovery,
                  recoveryDate: new Date(wageData.salary_month),
                  recoveryMethod: 'salary_deduction',
                  status: newStatus === 'fully_recovered' ? 'completed' : 'pending',
                  reason: `Salary deduction for ${new Date(wageData.salary_month).toLocaleDateString()}`,
                  previousBalance: newAdvance.remainingBalance,
                  newBalance: newBalance,
                  wageId: updatedWage._id,
                  userId,
                  firmId
                });

                const savedRecovery = await recovery.save({ session });

                // Update wage with recovery ID
                await Wage.findByIdAndUpdate(
                  updatedWage._id,
                  { advance_recovery_id: savedRecovery._id },
                  { session }
                );

                // Update advance balance
                await EmployeeAdvance.findByIdAndUpdate(
                  wageData.selectedAdvanceId,
                  {
                    remainingBalance: newBalance,
                    status: newStatus
                  },
                  { session }
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
