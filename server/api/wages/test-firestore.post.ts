import { defineEventHandler, readBody, createError } from 'h3'
import LedgerModel from '../../models/expenses/Ledger.model'
import LedgerTxnModel from '../../models/expenses/LedgerTxn.model'
import ExpenseModel from '../../models/expenses/Expense.model'
import mongoose from 'mongoose'

/**
 * Test endpoint for Firestore transactions
 * This is for testing purposes only and should be removed in production
 */
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
    const { ledgerId } = await readBody(event)

    if (!ledgerId) {
      throw createError({
        statusCode: 400,
        message: 'ledgerId is required'
      })
    }

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const Ledger = LedgerModel();
        const LedgerTxn = LedgerTxnModel();
        const Expense = ExpenseModel();
        const firmIdStr = String(firmId);
        const userIdStr = String(userId);
        const ledger = await Ledger.findOne({ _id: ledgerId, firmId: firmIdStr }).session(session)
        if (!ledger) throw new Error(`Ledger with ID ${ledgerId} not found`)
        const testAmount = 1
        const newBalance = Number(ledger.currentBalance || 0) - testAmount
        await Expense.create([{ amount: -testAmount, category: 'PAYMENT', date: new Date(), description: 'TEST TRANSACTION - PLEASE IGNORE', firmId: firmIdStr, userId: userIdStr, paidTo: 'TEST USER', paidToGroup: 'TEST', paymentMode: { type: 'bank', bankId: ledgerId, instrumentNo: 'TEST123' }, netAmount: -testAmount, isTransfer: false, transferDetails: null }], { session })
        await Ledger.updateOne({ _id: ledger._id }, { $set: { currentBalance: newBalance, updatedAt: new Date() } }).session(session)
        await LedgerTxn.create([{ ledgerId: String(ledger._id), amount: testAmount, type: 'debit', balance: newBalance, date: new Date(), description: 'TEST TRANSACTION - PLEASE IGNORE', firmId: firmIdStr, userId: userIdStr, createdAt: new Date(), updatedAt: new Date() }], { session })
      })
    } finally { session.endSession() }
    
    return {
      success: true,
      message: 'Test transaction completed successfully'
    }
  } catch (error) {
    console.error('Error in test transaction:', error)
    throw createError({
      statusCode: 500,
      message: error?.message || 'Error in test transaction'
    })
  }
})
