import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing a specific expense
 *
 * Handles GET (retrieve), PUT (update), DELETE (remove) operations
 */
export default defineEventHandler(async (event) => {
  // Ensure user is authenticated
  const userId = event.context.userId;
  const firmId = event.context.user?.firmId;

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    });
  }

  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Expense ID is required'
    });
  }

  const db = getFirestore();
  const expenseRef = db.collection('expenses').doc(id);

  // GET - Get a specific expense
  if (event.method === 'GET') {
    try {
      const doc = await expenseRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Expense not found'
        });
      }

      const expense = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this expense
      if (expense.firmId !== firmIdStr) {

        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      return {
        id: doc.id,
        ...expense,
        date: expense.date.toDate(),
        createdAt: expense.createdAt?.toDate(),
        updatedAt: expense.updatedAt?.toDate()
      };
    } catch (error) {

      throw createError({
        statusCode: 500,
        message: 'Failed to fetch expense'
      });
    }
  }

  // PUT - Update an expense
  if (event.method === 'PUT') {
    try {
      const doc = await expenseRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Expense not found'
        });
      }

      const existingExpense = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this expense
      if (existingExpense.firmId !== firmIdStr) {

        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      const body = await readBody(event);

      // Process deductions if present
      let processedDeductions = [];
      let totalDeductions = 0;
      let netAmount = body.amount !== undefined ? Number(body.amount) : existingExpense.amount;

      if (body.hasDeductions !== undefined) {
        if (body.hasDeductions && body.deductions && Array.isArray(body.deductions)) {
          processedDeductions = body.deductions.map(deduction => ({
            id: deduction.id || `deduction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: deduction.name || '',
            amount: Math.abs(Number(deduction.amount) || 0), // Ensure positive amount
            description: deduction.description || ''
          }));

          totalDeductions = processedDeductions.reduce((sum, deduction) => sum + deduction.amount, 0);

          // Calculate net amount based on transaction type
          const category = body.category || existingExpense.category;
          if (category === 'RECEIPT' || netAmount > 0) {
            // For receipts: net = gross - deductions
            netAmount = Math.abs(netAmount) - totalDeductions;
          } else {
            // For payments: net = -(gross - deductions)
            netAmount = -(Math.abs(netAmount) - totalDeductions);
          }
        }
      } else if (existingExpense.hasDeductions) {
        // Keep existing deductions if not updating them
        processedDeductions = existingExpense.deductions || [];
        netAmount = existingExpense.netAmount || netAmount;
      }

      // Prepare update data
      const updateData = {
        updatedAt: Timestamp.now()
      };

      // Update fields if provided
      if (body.date) {
        updateData.date = Timestamp.fromDate(new Date(body.date));
      }

      if (body.paidTo) {
        updateData.paidTo = body.paidTo;
      }

      if (body.amount !== undefined) {
        updateData.amount = Number(body.amount); // Gross amount
      }

      if (body.category !== undefined) {
        updateData.category = body.category;
      }

      if (body.project !== undefined) {
        updateData.project = body.project;
      }

      if (body.paymentMode) {
        // Validate payment mode
        if (body.paymentMode.type === 'bank' && !body.paymentMode.instrumentNo) {
          throw createError({
            statusCode: 400,
            message: 'Instrument number is required for bank payments'
          });
        }
        updateData.paymentMode = body.paymentMode;
      }

      if (body.description !== undefined) {
        updateData.description = body.description;
      }

      if (body.paidToGroup !== undefined) {
        updateData.paidToGroup = body.paidToGroup;
      }

      if (body.hasDeductions !== undefined) {
        updateData.hasDeductions = body.hasDeductions;
        updateData.deductions = processedDeductions;
        updateData.netAmount = netAmount;
      }

      if (body.isTransfer !== undefined) {
        updateData.isTransfer = body.isTransfer;
      }

      if (body.transferDetails) {
        updateData.transferDetails = body.transferDetails;
      }

      // Check if amount, deductions, or payment mode changed
      const amountChanged = body.amount !== undefined && body.amount !== existingExpense.amount;
      const deductionsChanged = body.hasDeductions !== undefined &&
        (body.hasDeductions !== existingExpense.hasDeductions ||
         JSON.stringify(processedDeductions) !== JSON.stringify(existingExpense.deductions || []));
      const netAmountChanged = updateData.netAmount !== undefined && updateData.netAmount !== (existingExpense.netAmount || existingExpense.amount);
      const paymentModeTypeChanged = body.paymentMode && body.paymentMode.type !== existingExpense.paymentMode.type;
      const bankIdChanged = body.paymentMode && body.paymentMode.bankId !== existingExpense.paymentMode.bankId;

      // If no financial changes, just update the expense directly
      if (!amountChanged && !deductionsChanged && !netAmountChanged && !paymentModeTypeChanged && !bankIdChanged) {
        console.log('No financial changes detected, updating expense directly');
        await expenseRef.update(updateData);
      } else {
        // For financial changes, use a transaction to ensure data consistency
        console.log('Financial changes detected, using atomic transaction', {
          amountChanged,
          deductionsChanged,
          netAmountChanged,
          paymentModeTypeChanged,
          bankIdChanged,
          oldAmount: existingExpense.amount,
          oldNetAmount: existingExpense.netAmount || existingExpense.amount,
          newAmount: body.amount,
          newNetAmount: updateData.netAmount
        });


        // Variables to store references and data
        let oldLedgerRef, oldLedgerData, oldLedgerNewBalance;
        let newLedgerRef, newLedgerData, newLedgerNewBalance, adjustedBalance;
        const newLedgerType = body.paymentMode?.type || existingExpense.paymentMode.type;
        const newBankId = body.paymentMode?.bankId || existingExpense.paymentMode.bankId;
        const newAmount = body.amount || existingExpense.amount;
        const oldNetAmount = existingExpense.netAmount || existingExpense.amount;
        const newNetAmount = updateData.netAmount || newAmount;
        const newPaidTo = body.paidTo || existingExpense.paidTo;
        const isOldReceipt = oldNetAmount > 0;
        const isNewReceipt = newNetAmount > 0;

        // Use a transaction to ensure data consistency
        await db.runTransaction(async (transaction) => {


          // STEP 1: PERFORM ALL READS FIRST

          // Get the old ledger reference
          if (existingExpense.paymentMode.type === 'cash') {
            // Query for cash ledger
            const oldLedgerQuery = db.collection('ledgers')
              .where('firmId', '==', firmId.toString())
              .where('type', '==', 'cash')
              .limit(1);

            const oldLedgerSnapshot = await transaction.get(oldLedgerQuery);

            if (oldLedgerSnapshot.empty) {
              throw new Error('Old cash ledger not found');
            }

            oldLedgerRef = oldLedgerSnapshot.docs[0].ref;
          } else {
            // Use bank ledger directly
            oldLedgerRef = db.collection('ledgers').doc(existingExpense.paymentMode.bankId);
          }

          // Get old ledger data
          const oldLedgerDoc = await transaction.get(oldLedgerRef);

          if (!oldLedgerDoc.exists) {
            throw new Error(`Old ledger not found: ${existingExpense.paymentMode.type}`);
          }

          oldLedgerData = oldLedgerDoc.data();

          // Calculate new balance for old ledger using net amount
          oldLedgerNewBalance = oldLedgerData.currentBalance - oldNetAmount;

          // Determine if we need a new ledger or can reuse the old one
          if (newLedgerType === 'cash') {
            // If we're already using the cash ledger and it hasn't changed, reuse the reference
            if (existingExpense.paymentMode.type === 'cash' && !paymentModeTypeChanged) {
              newLedgerRef = oldLedgerRef;
              newLedgerData = oldLedgerData;
              // For same ledger, calculate the adjusted balance using net amount
              adjustedBalance = oldLedgerNewBalance + newNetAmount;
            } else {
              // Query for cash ledger
              const newLedgerQuery = db.collection('ledgers')
                .where('firmId', '==', firmId.toString())
                .where('type', '==', 'cash')
                .limit(1);

              const newLedgerSnapshot = await transaction.get(newLedgerQuery);

              if (newLedgerSnapshot.empty) {
                throw new Error('New cash ledger not found');
              }

              newLedgerRef = newLedgerSnapshot.docs[0].ref;

              // Get new ledger data if it's different from the old one
              if (newLedgerRef.id !== oldLedgerRef.id) {
                const newLedgerDoc = await transaction.get(newLedgerRef);

                if (!newLedgerDoc.exists) {
                  throw new Error(`New ledger not found: ${newLedgerType}`);
                }

                newLedgerData = newLedgerDoc.data();
                newLedgerNewBalance = newLedgerData.currentBalance + newNetAmount;
              }
            }
          } else {
            // Use bank ledger directly
            newLedgerRef = db.collection('ledgers').doc(newBankId);

            // Get new ledger data if it's different from the old one
            if (newLedgerRef.id !== oldLedgerRef.id) {
              const newLedgerDoc = await transaction.get(newLedgerRef);

              if (!newLedgerDoc.exists) {
                throw new Error(`New ledger not found: ${newLedgerType}`);
              }

              newLedgerData = newLedgerDoc.data();
              newLedgerNewBalance = newLedgerData.currentBalance + newNetAmount;
            } else {
              newLedgerData = oldLedgerData;
              // For same ledger, calculate the adjusted balance using net amount
              adjustedBalance = oldLedgerNewBalance + newNetAmount;
            }
          }

          // STEP 2: PERFORM ALL WRITES

          // Update the expense document in the transaction
          transaction.update(expenseRef, updateData);

          // Update old ledger balance
          transaction.update(oldLedgerRef, {
            currentBalance: oldLedgerNewBalance,
            updatedAt: Timestamp.now()
          });

          // Create reversal transaction record
          const reversalTransactionRef = db.collection('ledgerTransactions').doc();

          transaction.set(reversalTransactionRef, {
            ledgerId: oldLedgerRef.id,
            expenseId: id,
            date: Timestamp.now(),
            description: `Reversal: ${isOldReceipt ? 'Receipt from' : 'Payment to'} ${existingExpense.paidTo}${existingExpense.hasDeductions ? ' (net after deductions)' : ''}`,
            amount: Math.abs(oldNetAmount), // Use net amount for reversal
            type: isOldReceipt ? 'debit' : 'credit', // Opposite of the original
            balance: oldLedgerNewBalance,
            firmId: firmId.toString(),
            createdAt: Timestamp.now()
          });

          // If using different ledgers, update the new one
          if (newLedgerRef.id !== oldLedgerRef.id) {
            // Update new ledger balance
            transaction.update(newLedgerRef, {
              currentBalance: newLedgerNewBalance,
              updatedAt: Timestamp.now()
            });

            // Create new transaction record
            const newTransactionRef = db.collection('ledgerTransactions').doc();

            transaction.set(newTransactionRef, {
              ledgerId: newLedgerRef.id,
              expenseId: id,
              date: updateData.date || existingExpense.date,
              description: isNewReceipt ?
                (`Receipt from ${newPaidTo}${updateData.hasDeductions ? ' (net after deductions)' : ''}`) :
                (`Payment to ${newPaidTo}${updateData.hasDeductions ? ' (net after deductions)' : ''}`),
              amount: Math.abs(newNetAmount), // Use net amount
              type: isNewReceipt ? 'credit' : 'debit',
              balance: newLedgerNewBalance,
              firmId: firmId.toString(),
              createdAt: Timestamp.now()
            });
          } else {
            // Same ledger, update with the adjusted balance
            transaction.update(newLedgerRef, {
              currentBalance: adjustedBalance,
              updatedAt: Timestamp.now()
            });

            // Create adjustment transaction record
            const adjustmentTransactionRef = db.collection('ledgerTransactions').doc();

            transaction.set(adjustmentTransactionRef, {
              ledgerId: newLedgerRef.id,
              expenseId: id,
              date: updateData.date || existingExpense.date,
              description: isNewReceipt ?
                (`Updated: Receipt from ${newPaidTo}${updateData.hasDeductions ? ' (net after deductions)' : ''}`) :
                (`Updated: Payment to ${newPaidTo}${updateData.hasDeductions ? ' (net after deductions)' : ''}`),
              amount: Math.abs(newNetAmount), // Use net amount
              type: isNewReceipt ? 'credit' : 'debit',
              balance: adjustedBalance,
              firmId: firmId.toString(),
              createdAt: Timestamp.now()
            });
          }

        });
      }

      // If this is for a sub and amount changed, update the subs entry
      if (existingExpense.paidToGroup === 'subs' && body.amount !== undefined && body.amount !== existingExpense.amount) {
        await updateSubsEntry(db, firmId, id, existingExpense.amount, body.amount);
      }

      // Get the updated document
      const updatedDoc = await expenseRef.get();
      const updatedExpense = updatedDoc.data();

      return {
        id: updatedDoc.id,
        ...updatedExpense,
        date: updatedExpense.date.toDate(),
        createdAt: updatedExpense.createdAt?.toDate(),
        updatedAt: updatedExpense.updatedAt?.toDate()
      };
    } catch (error) {
      console.error('Error updating expense:', error);
      throw createError({
        statusCode: 500,
        message: 'Failed to update expense'
      });
    }
  }

  // DELETE - Delete an expense
  if (event.method === 'DELETE') {
    try {
      const doc = await expenseRef.get();

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Expense not found'
        });
      }

      const expense = doc.data();

      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();

      // Check if user has access to this expense
      if (expense.firmId !== firmIdStr) {
        console.error('Access denied: expense.firmId =', expense.firmId, 'firmIdStr =', firmIdStr);
        throw createError({
          statusCode: 403,
          message: 'Access denied'
        });
      }

      // Use a transaction to ensure data consistency
      await db.runTransaction(async (transaction) => {


        // Get the ledger reference
        let ledgerRef;
        if (expense.paymentMode.type === 'cash') {
          // Query for cash ledger
          const ledgerQuery = db.collection('ledgers')
            .where('firmId', '==', firmId.toString())
            .where('type', '==', 'cash')
            .limit(1);

          const ledgerSnapshot = await transaction.get(ledgerQuery);

          if (ledgerSnapshot.empty) {
            throw new Error('Cash ledger not found');
          }

          ledgerRef = ledgerSnapshot.docs[0].ref;
        } else {
          // Use bank ledger directly
          ledgerRef = db.collection('ledgers').doc(expense.paymentMode.bankId);
        }

        // Get ledger data
        const ledgerDoc = await transaction.get(ledgerRef);

        if (!ledgerDoc.exists) {
          throw new Error(`Ledger not found: ${expense.paymentMode.type}`);
        }

        const ledger = ledgerDoc.data();

        // Calculate new balance by reversing the net expense amount
        const netAmountToReverse = expense.netAmount || expense.amount;
        const newBalance = ledger.currentBalance - netAmountToReverse;
        const isReceipt = netAmountToReverse > 0;

        // Update ledger balance
        transaction.update(ledgerRef, {
          currentBalance: newBalance,
          updatedAt: Timestamp.now()
        });

        // Create reversal transaction record
        const transactionRef = db.collection('ledgerTransactions').doc();

        transaction.set(transactionRef, {
          ledgerId: ledgerRef.id,
          expenseId: id,
          date: Timestamp.now(),
          description: `Deleted: ${isReceipt ? 'Receipt from' : 'Payment to'} ${expense.paidTo}${expense.hasDeductions ? ' (net after deductions)' : ''}`,
          amount: Math.abs(netAmountToReverse), // Use net amount
          type: isReceipt ? 'debit' : 'credit', // Opposite of the original
          balance: newBalance,
          firmId: firmId.toString(),
          createdAt: Timestamp.now()
        });

        // Delete the expense document
        transaction.delete(expenseRef);


      });

      // If this is for a sub, delete the subs entry (outside transaction for now)
      if (expense.paidToGroup === 'subs') {
        await deleteSubsEntry(db, firmId, id);
      }

      return {
        message: 'Expense deleted successfully'
      };
    } catch (error) {

      throw createError({
        statusCode: 500,
        message: 'Failed to delete expense'
      });
    }
  }
});



/**
 * Helper function to handle transfers between accounts
 */
async function handleTransfer(db, firmId, transferDetails, amount, expenseId) {
  try {
    const ledgersCollection = db.collection('ledgers');
    const transactionsCollection = db.collection('ledgerTransactions');
    const now = Timestamp.now();

    // Get source ledger
    let sourceQuery;

    // Convert firmId to string to avoid ObjectId issues
    const firmIdStr = firmId.toString();

    if (transferDetails.fromMode === 'cash') {
      sourceQuery = ledgersCollection
        .where('firmId', '==', firmIdStr)
        .where('type', '==', 'cash')
        .limit(1);
    } else {
      sourceQuery = ledgersCollection.doc(transferDetails.fromBankId);
    }

    const sourceSnapshot = transferDetails.fromMode === 'cash'
      ? await sourceQuery.get()
      : { docs: [await sourceQuery.get()] };

    if (sourceSnapshot.empty || !sourceSnapshot.docs[0].exists) {
      throw new Error('Source ledger not found');
    }

    const sourceDoc = sourceSnapshot.docs[0];
    const source = sourceDoc.data();

    // Get destination ledger
    let destQuery;
    if (transferDetails.toMode === 'cash') {
      destQuery = ledgersCollection
        .where('firmId', '==', firmIdStr)
        .where('type', '==', 'cash')
        .limit(1);
    } else {
      destQuery = ledgersCollection.doc(transferDetails.toBankId);
    }

    const destSnapshot = transferDetails.toMode === 'cash'
      ? await destQuery.get()
      : { docs: [await destQuery.get()] };

    if (destSnapshot.empty || !destSnapshot.docs[0].exists) {
      throw new Error('Destination ledger not found');
    }

    const destDoc = destSnapshot.docs[0];
    const dest = destDoc.data();

    // Update source ledger (debit)
    const newSourceBalance = source.currentBalance - amount;
    await sourceDoc.ref.update({
      currentBalance: newSourceBalance,
      updatedAt: now
    });

    // Create source transaction
    await transactionsCollection.add({
      ledgerId: sourceDoc.id,
      expenseId,
      date: now,
      description: `Transfer to ${dest.name}`,
      amount,
      type: 'debit',
      balance: newSourceBalance,
      firmId: firmIdStr,
      createdAt: now
    });

    // Update destination ledger (credit)
    const newDestBalance = dest.currentBalance + amount;
    await destDoc.ref.update({
      currentBalance: newDestBalance,
      updatedAt: now
    });

    // Create destination transaction
    await transactionsCollection.add({
      ledgerId: destDoc.id,
      expenseId,
      date: now,
      description: `Transfer from ${source.name}`,
      amount,
      type: 'credit',
      balance: newDestBalance,
      firmId: firmIdStr,
      createdAt: now
    });
  } catch (error) {

    throw error;
  }
}

/**
 * Helper function to update a subs entry
 */
async function updateSubsEntry(db, firmId, expenseId, oldAmount, newAmount) {
  try {
    const subsCollection = db.collection('subs');
    // Convert firmId to string to avoid ObjectId issues
    const firmIdStr = firmId.toString();

    const subsQuery = subsCollection
      .where('firmId', '==', firmIdStr)
      .where('parentExpenseId', '==', expenseId)
      .limit(1);

    const subsSnapshot = await subsQuery.get();

    if (!subsSnapshot.empty) {
      const subsDoc = subsSnapshot.docs[0];
      const sub = subsDoc.data();

      // Update the amount
      await subsDoc.ref.update({
        amount: newAmount,
        updatedAt: Timestamp.now()
      });

      // Update the sub's balance
      const subsModelCollection = db.collection('subsModels');
      const subsModelQuery = subsModelCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', sub.paidTo)
        .limit(1);

      const subsModelSnapshot = await subsModelQuery.get();

      if (!subsModelSnapshot.empty) {
        const subsModelDoc = subsModelSnapshot.docs[0];
        const subsModel = subsModelDoc.data();

        // Adjust the balance
        const balanceAdjustment = newAmount - oldAmount;
        await subsModelDoc.ref.update({
          balance: subsModel.balance + balanceAdjustment,
          updatedAt: Timestamp.now()
        });
      }
    }
  } catch (error) {

    // Don't throw, just log the error to prevent the main transaction from failing
  }
}

/**
 * Helper function to delete a subs entry
 */
async function deleteSubsEntry(db, firmId, expenseId) {
  try {
    const subsCollection = db.collection('subs');
    // Convert firmId to string to avoid ObjectId issues
    const firmIdStr = firmId.toString();

    const subsQuery = subsCollection
      .where('firmId', '==', firmIdStr)
      .where('parentExpenseId', '==', expenseId)
      .limit(1);

    const subsSnapshot = await subsQuery.get();

    if (!subsSnapshot.empty) {
      const subsDoc = subsSnapshot.docs[0];
      const sub = subsDoc.data();

      // Update the sub's balance
      const subsModelCollection = db.collection('subsModels');
      const subsModelQuery = subsModelCollection
        .where('firmId', '==', firmIdStr)
        .where('name', '==', sub.paidTo)
        .limit(1);

      const subsModelSnapshot = await subsModelQuery.get();

      if (!subsModelSnapshot.empty) {
        const subsModelDoc = subsModelSnapshot.docs[0];
        const subsModel = subsModelDoc.data();

        // Adjust the balance
        await subsModelDoc.ref.update({
          balance: subsModel.balance - sub.amount,
          updatedAt: Timestamp.now()
        });
      }

      // Delete the subs entry
      await subsDoc.ref.delete();
    }
  } catch (error) {

    // Don't throw, just log the error to prevent the main transaction from failing
  }
}
