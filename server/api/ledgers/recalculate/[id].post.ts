import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

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
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'Ledger ID is required'
      })
    }

    console.log(`Recalculating balance for ledger ${id}`)

    const db = getFirestore()
    const ledgerRef = db.collection('ledgers').doc(id)

    // Get the ledger
    const ledgerDoc = await ledgerRef.get()

    if (!ledgerDoc.exists) {
      throw createError({
        statusCode: 404,
        message: 'Ledger not found'
      })
    }

    const ledgerData = ledgerDoc.data()

    // Check if user has access to this ledger
    if (ledgerData.firmId !== firmId.toString()) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      })
    }

    // First, check if there are any existing recalculation adjustment entries
    const existingAdjustmentsQuery = db.collection('ledgerTransactions')
      .where('ledgerId', '==', id)
      .where('description', '==', 'Balance Recalculation Adjustment')

    const existingAdjustmentsSnapshot = await existingAdjustmentsQuery.get()
    const existingAdjustmentDocs = existingAdjustmentsSnapshot.docs

    // Get all regular transactions (excluding recalculation adjustments)
    const transactionsQuery = db.collection('ledgerTransactions')
      .where('ledgerId', '==', id)
      .orderBy('date', 'asc')

    const transactionsSnapshot = await transactionsQuery.get()
    const allTransactionDocs = transactionsSnapshot.docs

    // Filter out the recalculation adjustment entries
    const regularTransactionDocs = allTransactionDocs.filter(doc => {
      const data = doc.data()
      return data.description !== 'Balance Recalculation Adjustment'
    })

    // Calculate the correct balance based on opening balance and regular transactions only
    let calculatedBalance = ledgerData.openingBalance
    let balanceUpdatesNeeded = false
    const transactionUpdates = []

    // First pass: calculate correct balances for all regular transactions
    for (let i = 0; i < regularTransactionDocs.length; i++) {
      const doc = regularTransactionDocs[i]
      const transaction = doc.data()
      const oldBalance = transaction.balance || 0

      // Calculate the correct balance for this transaction
      if (transaction.type === 'credit') {
        calculatedBalance += transaction.amount
      } else if (transaction.type === 'debit') {
        calculatedBalance -= transaction.amount
      }

      // Check if the balance needs updating
      if (oldBalance !== calculatedBalance) {
        balanceUpdatesNeeded = true
        transactionUpdates.push({
          docRef: doc.ref,
          newBalance: calculatedBalance
        })
      }
    }

    // Get the current balance from the ledger
    const currentBalance = ledgerData.currentBalance

    // If the calculated balance is different from the current balance or transaction balances need updating
    if (calculatedBalance !== currentBalance || balanceUpdatesNeeded) {
      // Create a transaction record for the adjustment if ledger balance is different
      const adjustmentAmount = calculatedBalance - currentBalance
      const needAdjustmentTransaction = calculatedBalance !== currentBalance

      await db.runTransaction(async (transaction) => {
        // Delete any existing recalculation adjustment entries
        for (const doc of existingAdjustmentDocs) {
          transaction.delete(doc.ref)
        }

        // Update the ledger balance if needed
        if (calculatedBalance !== currentBalance) {
          transaction.update(ledgerRef, {
            currentBalance: calculatedBalance,
            updatedAt: Timestamp.now()
          })
        }

        // Update all transaction balances that need updating
        for (const update of transactionUpdates) {
          transaction.update(update.docRef, {
            balance: update.newBalance,
            updatedAt: Timestamp.now()
          })
        }

        // Add a ledger transaction record for this adjustment if needed
        if (needAdjustmentTransaction) {
          const ledgerTransactionRef = db.collection('ledgerTransactions').doc()
          transaction.set(ledgerTransactionRef, {
            ledgerId: id,
            expenseId: `balance_recalculation_${Date.now()}`,
            date: Timestamp.now(),
            description: 'Balance Recalculation Adjustment',
            amount: Math.abs(adjustmentAmount),
            type: adjustmentAmount > 0 ? 'credit' : 'debit',
            balance: calculatedBalance,
            firmId: firmId.toString(),
            userId: userId.toString(),
            createdAt: Timestamp.now()
          })
        }
      })

      return {
        success: true,
        message: balanceUpdatesNeeded
          ? 'Ledger balance and transaction balances recalculated successfully'
          : 'Ledger balance recalculated successfully',
        previousBalance: currentBalance,
        newBalance: calculatedBalance,
        difference: adjustmentAmount,
        transactionsCount: regularTransactionDocs.length,
        transactionsUpdated: transactionUpdates.length,
        adjustmentsRemoved: existingAdjustmentDocs.length
      }
    } else {
      return {
        success: true,
        message: 'Ledger balance and transaction balances are already correct',
        balance: currentBalance,
        transactionsCount: regularTransactionDocs.length,
        adjustmentsRemoved: existingAdjustmentDocs.length
      }
    }
  } catch (error: any) {
    console.error('Error recalculating ledger balance:', error)

    throw createError({
      statusCode: error.statusCode || 500,
      message: `Error recalculating ledger balance: ${error.message}`
    })
  }
})
