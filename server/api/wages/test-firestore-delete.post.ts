import { defineEventHandler, readBody, createError } from 'h3'
import ExpenseModel from '../../models/expenses/Expense.model'
import LedgerModel from '../../models/expenses/Ledger.model'
import LedgerTxnModel from '../../models/expenses/LedgerTxn.model'

/**
 * Test endpoint for Firestore deletion
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
    const { wageId, ledgerId } = await readBody(event)

    if (!wageId) {
      throw createError({
        statusCode: 400,
        message: 'wageId is required'
      })
    }

    if (!ledgerId) {
      throw createError({
        statusCode: 400,
        message: 'ledgerId is required'
      })
    }

    const firmIdStr = firmId.toString()
    
    const Expense = ExpenseModel();
    const Ledger = LedgerModel();
    const LedgerTxn = LedgerTxnModel();
    // 1. Find expense records related to this wage
    const expenseCount = await Expense.countDocuments({ firmId: firmIdStr, expenseId: wageId.toString(), paidToGroup: 'SALARY' })
    console.log(`Found ${expenseCount} expense records for wage ID: ${wageId}`)
    
    // 2. Find ledger transaction records related to this wage
    const transactionCount = await LedgerTxn.countDocuments({ firmId: firmIdStr, expenseId: wageId.toString() })
    console.log(`Found ${transactionCount} ledger transaction records for wage ID: ${wageId}`)
    
    // 3. Get the ledger document
    const ledger = await Ledger.findOne({ _id: ledgerId, firmId: firmIdStr }).lean()
    const ledgerBalance = ledger ? ledger.currentBalance : null
    
    return {
      success: true,
      wageId,
      ledgerId,
      expenseCount,
      transactionCount,
      ledgerBalance,
      message: 'Test completed successfully'
    }
  } catch (error) {
    console.error('Error in test:', error)
    throw createError({
      statusCode: 500,
      message: error?.message || 'Error in test'
    })
  }
})
