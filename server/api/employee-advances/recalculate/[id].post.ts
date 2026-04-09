import { defineEventHandler, getRouterParam, createError } from 'h3'
import EmployeeAdvance from '../../../models/EmployeeAdvance'
import AdvanceRecovery from '../../../models/AdvanceRecovery'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    const userId = event.context.userId
    const firmId = event.context.user?.firmId

    if (!userId || !firmId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      })
    }

    // Find the advance
    const advance = await EmployeeAdvance.findOne({
      _id: id,
      firmId
    })

    if (!advance) {
      throw createError({
        statusCode: 404,
        message: 'Advance not found'
      })
    }

    // Get all recoveries for this advance
    const recoveries = await AdvanceRecovery.find({
      advanceId: id,
      firmId
    })

    // Calculate total recovered amount
    const totalRecovered = recoveries.reduce((sum, recovery) => sum + recovery.recoveryAmount, 0)

    // Calculate new remaining balance
    const newRemainingBalance = Math.max(0, advance.amount - totalRecovered)

    // Determine new status
    let newStatus = advance.status
    if (newRemainingBalance === 0) {
      newStatus = 'fully_recovered'
    } else if (newRemainingBalance < advance.amount) {
      newStatus = 'partially_recovered'
    } else if (advance.status === 'pending') {
      newStatus = 'pending'
    } else {
      newStatus = 'approved'
    }

    // Update the advance
    const updatedAdvance = await EmployeeAdvance.findByIdAndUpdate(
      id,
      {
        remainingBalance: newRemainingBalance,
        status: newStatus
      },
      { new: true }
    )

    return {
      success: true,
      advance: updatedAdvance,
      message: 'Advance balance recalculated successfully',
      previousBalance: advance.remainingBalance,
      newBalance: newRemainingBalance,
      totalRecovered
    }
  } catch (error: any) {
    console.error('Error recalculating advance balance:', error)

    throw createError({
      statusCode: error.statusCode || 500,
      message: `Error recalculating advance balance: ${error.message}`
    })
  }
})
