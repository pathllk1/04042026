import { defineEventHandler, readBody, createError } from 'h3'
import Ledger from '../../models/Ledger'
import LedgerTransaction from '../../models/LedgerTransaction'
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const userId = user?.id
  const firmId = user?.firmId

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { ledgerId, oldWages, newWages } = await readBody(event)

    if (!ledgerId) {
      throw createError({
        statusCode: 400,
        message: 'ledgerId is required'
      })
    }

    if (!oldWages || !Array.isArray(oldWages) || !newWages || !Array.isArray(newWages)) {
      throw createError({
        statusCode: 400,
        message: 'oldWages and newWages must be arrays'
      })
    }

    const oldTotal = oldWages.reduce((sum, wage) => sum + (Number(wage.net_salary) || 0), 0)
    const newTotal = newWages.reduce((sum, wage) => sum + (Number(wage.net_salary) || 0), 0)
    const adjustmentAmount = oldTotal - newTotal
    
    if (adjustmentAmount === 0) {
      await session.abortTransaction()
      session.endSession()
      return {
        success: true,
        message: 'No adjustment needed, wage totals unchanged',
        ledgerId,
        adjustmentAmount: 0
      }
    }
    
    const ledger = await Ledger.findOne({ _id: ledgerId, firmId }).session(session)
    
    if (!ledger) {
      throw new Error(`Ledger with ID ${ledgerId} not found`)
    }
    
    const newBalance = ledger.currentBalance + adjustmentAmount
    
    // Update ledger balance
    ledger.currentBalance = newBalance
    await ledger.save({ session })
    
    // Add a ledger transaction record
    await LedgerTransaction.create([{
      ledgerId: ledger._id,
      amount: Math.abs(adjustmentAmount),
      balance: newBalance,
      type: adjustmentAmount > 0 ? "credit" : "debit",
      description: adjustmentAmount > 0 
        ? `Balance adjustment (credit): Wage edit correction` 
        : `Balance adjustment (debit): Wage edit correction`,
      expenseId: `wage_edit_adjustment_${Date.now()}`,
      firmId: firmId,
      userId: userId,
      date: new Date()
    }], { session })

    await session.commitTransaction()
    session.endSession()
    
    return {
      success: true,
      message: `Successfully updated ledger balance with adjustment amount: ${adjustmentAmount}`,
      ledgerId,
      adjustmentAmount
    }
  } catch (error: any) {
    await session.abortTransaction()
    session.endSession()
    console.error('Error updating Mongoose ledger balance for wage edits:', error)
    throw createError({
      statusCode: 500,
      message: error?.message || 'Error updating ledger balance'
    })
  }
})
