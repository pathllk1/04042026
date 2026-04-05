import { defineEventHandler, readBody, createError } from 'h3'
import LedgerModel from '../../models/expenses/Ledger.model'
import LedgerTxnModel from '../../models/expenses/LedgerTxn.model'
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const firmId = event.context.user?.firmId

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  try {
    const { ledgerId, adjustmentAmount } = await readBody(event)

    if (!ledgerId) {
      throw createError({
        statusCode: 400,
        message: 'ledgerId is required'
      })
    }

    if (typeof adjustmentAmount !== 'number') {
      throw createError({
        statusCode: 400,
        message: 'adjustmentAmount must be a number'
      })
    }

    console.log(`Updating ledger ${ledgerId} balance with adjustment amount: ${adjustmentAmount}`)
    
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const Ledger = LedgerModel();
        const LedgerTxn = LedgerTxnModel();
        const ledger = await Ledger.findOne({ _id: ledgerId, firmId: String(firmId) }).session(session)
        if (!ledger) throw new Error(`Ledger with ID ${ledgerId} not found`)
        const newBalance = Number(ledger.currentBalance || 0) + Number(adjustmentAmount)
        await Ledger.updateOne({ _id: ledger._id }, { $set: { currentBalance: newBalance, updatedAt: new Date() } }).session(session)
        if (adjustmentAmount !== 0) {
          await LedgerTxn.create([
            {
              ledgerId: String(ledger._id),
              expenseId: `adjustment_${Date.now()}`,
              date: new Date(),
              description: adjustmentAmount > 0 ? 'Balance adjustment (credit): Wage record correction' : 'Balance adjustment (debit): Wage record correction',
              amount: Math.abs(Number(adjustmentAmount)),
              type: Number(adjustmentAmount) > 0 ? 'credit' : 'debit',
              balance: newBalance,
              firmId: String(firmId),
              userId: String(userId),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ], { session })
        }
      })
    } finally { session.endSession() }
    
    return {
      success: true,
      message: `Successfully updated ledger balance with adjustment amount: ${adjustmentAmount}`,
      ledgerId,
      adjustmentAmount
    }
  } catch (error) {
    console.error('Error updating Firestore ledger balance:', error)
    throw createError({
      statusCode: 500,
      message: error?.message || 'Error updating Firestore ledger balance'
    })
  }
})
