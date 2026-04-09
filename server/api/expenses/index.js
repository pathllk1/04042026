import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * API endpoint for managing expenses
 *
 * Handles GET (list), POST (create) operations
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

  const db = getFirestore();
  const expensesCollection = db.collection('expenses');

  // GET - List all expenses for the user's firm
  if (event.method === 'GET') {
    try {
      // Convert firmId to string to avoid ObjectId issues
      const firmIdStr = firmId.toString();


      // Get query parameters for filtering
      const query = getQuery(event);

      // Helper function to process Firestore snapshot
      function processSnapshot(snapshot) {
        if (snapshot.empty) {
          return [];
        }

        // Transform data
        const expenses = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          expenses.push({
            id: doc.id,
            ...data,
            date: data.date?.toDate().toISOString() || null,
            createdAt: data.createdAt?.toDate().toISOString() || null,
            updatedAt: data.updatedAt?.toDate().toISOString() || null,
            // Convert any Timestamp fields in subExpenses to ISO strings
            subExpenses: data.subExpenses ? data.subExpenses.map(sub => ({
              ...sub,
              date: sub.date?.toDate().toISOString() || null
            })) : []
          });
        });

        return expenses;
      }

      try {
        // First approach: Try with composite query (requires index)
        let expensesQuery = expensesCollection.where('firmId', '==', firmIdStr);

      // Apply filters if provided
      if (query.startDate && query.endDate) {
        expensesQuery = expensesQuery
          .where('date', '>=', new Date(query.startDate))
          .where('date', '<=', new Date(query.endDate));
      } else if (query.startDate) {
        expensesQuery = expensesQuery.where('date', '>=', new Date(query.startDate));
      } else if (query.endDate) {
        expensesQuery = expensesQuery.where('date', '<=', new Date(query.endDate));
      }

      if (query.paidTo) {
        expensesQuery = expensesQuery.where('paidTo', '==', query.paidTo);
      }

      if (query.category) {
        expensesQuery = expensesQuery.where('category', '==', query.category);
      }

      if (query.project) {
        expensesQuery = expensesQuery.where('project', '==', query.project);
      }

      if (query.paidToGroup) {
        expensesQuery = expensesQuery.where('paidToGroup', '==', query.paidToGroup);
      }

        // Execute the query
        const snapshot = await expensesQuery.orderBy('date', 'desc').get();
        return processSnapshot(snapshot);
      } catch (indexError) {


        // Fallback approach: Get all expenses for the firm and filter in memory
        const snapshot = await expensesCollection.where('firmId', '==', firmIdStr).get();

        // Process the snapshot
        let expenses = processSnapshot(snapshot);

        // Apply filters in memory
        if (query.startDate) {
          const startDate = new Date(query.startDate).getTime();
          expenses = expenses.filter(expense => new Date(expense.date).getTime() >= startDate);
        }

        if (query.endDate) {
          const endDate = new Date(query.endDate).getTime();
          expenses = expenses.filter(expense => new Date(expense.date).getTime() <= endDate);
        }

        if (query.paidTo) {
          expenses = expenses.filter(expense => expense.paidTo === query.paidTo);
        }

        if (query.category) {
          expenses = expenses.filter(expense => expense.category === query.category);
        }

        if (query.project) {
          expenses = expenses.filter(expense => expense.project === query.project);
        }

        if (query.paidToGroup) {
          expenses = expenses.filter(expense => expense.paidToGroup === query.paidToGroup);
        }

        if (query.isTransfer !== undefined) {
          const isTransfer = query.isTransfer === 'true';
          expenses = expenses.filter(expense => expense.isTransfer === isTransfer);
        }

        if (query.paymentMode) {
          expenses = expenses.filter(expense =>
            expense.paymentMode?.type === query.paymentMode
          );
        }

        // Sort by date descending
        expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return expenses;
      }
    } catch (error) {

      throw createError({
        statusCode: 500,
        message: 'Failed to fetch expenses'
      });
    }
  }

  // POST - Create a new expense
  if (event.method === 'POST') {
    try {
      const body = await readBody(event);

      // Validate required fields
      if (!body.date || !body.paidTo || body.amount === undefined || !body.paymentMode?.type) {
        throw createError({
          statusCode: 400,
          message: 'Missing required fields'
        });
      }

      // Validate payment mode
      if (body.paymentMode.type === 'bank' && !body.paymentMode.instrumentNo) {
        throw createError({
          statusCode: 400,
          message: 'Instrument number is required for bank payments'
        });
      }

      // Process deductions if present
      let processedDeductions = [];
      let totalDeductions = 0;
      let netAmount = Number(body.amount);

      if (body.hasDeductions && body.deductions && Array.isArray(body.deductions)) {
        processedDeductions = body.deductions.map(deduction => ({
          id: deduction.id || `deduction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: deduction.name || '',
          amount: Math.abs(Number(deduction.amount) || 0), // Ensure positive amount
          description: deduction.description || ''
        }));

        totalDeductions = processedDeductions.reduce((sum, deduction) => sum + deduction.amount, 0);

        // Calculate net amount based on transaction type
        if (body.category === 'RECEIPT' || Number(body.amount) > 0) {
          // For receipts: net = gross - deductions
          netAmount = Number(body.amount) - totalDeductions;
        } else {
          // For payments: net = gross - deductions (but amount is negative, so we add deductions)
          netAmount = Number(body.amount) + totalDeductions;
        }
      }

      // Create new expense document
      const now = Timestamp.now();
      const newExpense = {
        date: Timestamp.fromDate(new Date(body.date)),
        paidTo: body.paidTo,
        amount: Number(body.amount), // Gross amount
        category: body.category || 'PAYMENT',
        project: body.project || null,
        paymentMode: {
          type: body.paymentMode.type,
          instrumentNo: body.paymentMode.instrumentNo || null,
          bankId: body.paymentMode.bankId || null
        },
        description: body.description || null,
        paidToGroup: body.paidToGroup || null,
        // Dynamic deduction fields
        hasDeductions: body.hasDeductions || false,
        deductions: processedDeductions,
        netAmount: netAmount,
        firmId: firmId.toString(),
        userId: userId.toString(),
        isTransfer: body.isTransfer || false,
        transferDetails: body.transferDetails || null,
        createdAt: now,
        updatedAt: now
      };

      // Use a transaction to ensure data consistency
      let docRef;
      let expenseWithId;
      let ledgerRef;
      let ledgerData;

      // Create a new document reference outside the transaction
      docRef = expensesCollection.doc();

      // Add ID to the expense object
      expenseWithId = {
        ...newExpense,
        id: docRef.id
      };

      // Skip transaction for transfers - handle them separately
      if (newExpense.isTransfer && newExpense.transferDetails) {


        // Just save the expense document
        await docRef.set(expenseWithId);
      } else {
        // For regular expenses, use a transaction
        await db.runTransaction(async (transaction) => {


          // STEP 1: PERFORM ALL READS FIRST

          // Get the appropriate ledger reference
          if (newExpense.paymentMode.type === 'cash') {
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
            ledgerRef = db.collection('ledgers').doc(newExpense.paymentMode.bankId);
          }

          // Get current ledger data
          const ledgerDoc = await transaction.get(ledgerRef);

          if (!ledgerDoc.exists) {
            throw new Error(`Ledger not found: ${newExpense.paymentMode.type}`);
          }

          ledgerData = ledgerDoc.data();

          // Calculate new balance using net amount (actual amount that affects ledger)
          const netAmountForLedger = newExpense.netAmount;
          const newBalance = ledgerData.currentBalance + netAmountForLedger;
          const isReceipt = netAmountForLedger > 0;

          // STEP 2: PERFORM ALL WRITES

          // Set the expense document in the transaction
          transaction.set(docRef, expenseWithId);

          // Update ledger balance in the transaction
          transaction.update(ledgerRef, {
            currentBalance: newBalance,
            updatedAt: Timestamp.now()
          });

          // Create ledger transaction record
          const transactionRef = db.collection('ledgerTransactions').doc();

          transaction.set(transactionRef, {
            ledgerId: ledgerRef.id,
            expenseId: docRef.id,
            date: newExpense.date,
            description: isReceipt ?
              (`Receipt from ${newExpense.paidTo}${newExpense.hasDeductions ? ' (net after deductions)' : ''}`) :
              (`Payment to ${newExpense.paidTo}${newExpense.hasDeductions ? ' (net after deductions)' : ''}`),
            amount: Math.abs(netAmountForLedger), // Use net amount for ledger transaction
            type: isReceipt ? 'credit' : 'debit',
            balance: newBalance,
            firmId: firmId.toString(),
            createdAt: Timestamp.now()
          });


        });
      }

      // Handle transfers outside the transaction if needed
      if (newExpense.isTransfer && newExpense.transferDetails) {

        await handleTransfer(
          db,
          firmId,
          newExpense.transferDetails,
          newExpense.netAmount, // Use net amount for transfers
          docRef.id
        );
      }

      // If this is for a sub, create a corresponding entry in the subs collection
      // Only do this if the client hasn't already created a subs entry
      if (newExpense.paidToGroup === 'subs' && !body.createSubsEntry) {

        await createSubsEntry(db, firmId, userId, docRef.id, expenseWithId);
      }

      return {
        id: docRef.id,
        ...newExpense,
        date: new Date(body.date),
        createdAt: now.toDate(),
        updatedAt: now.toDate()
      };
    } catch (error) {

      throw createError({
        statusCode: 500,
        message: 'Failed to create expense'
      });
    }
  }
});



/**
 * Helper function to handle transfers between accounts
 */
async function handleTransfer(db, firmId, transferDetails, amount, expenseId) {
  try {
    // Convert firmId to string to avoid ObjectId issues
    const firmIdStr = firmId.toString();
    const now = Timestamp.now();

    // For transfers, we use the absolute value of the amount
    const transferAmount = Math.abs(amount);

    // Variables to store references and data
    let sourceRef, sourceData, destRef, destData;
    let newSourceBalance, newDestBalance;

    // Use a transaction to ensure data consistency
    await db.runTransaction(async (transaction) => {


      // STEP 1: PERFORM ALL READS FIRST

      // Get source ledger
      if (transferDetails.fromMode === 'cash') {
        const sourceQuery = db.collection('ledgers')
          .where('firmId', '==', firmIdStr)
          .where('type', '==', 'cash')
          .limit(1);

        const sourceSnapshot = await transaction.get(sourceQuery);

        if (sourceSnapshot.empty) {
          throw new Error('Source cash ledger not found');
        }

        sourceRef = sourceSnapshot.docs[0].ref;
      } else {
        sourceRef = db.collection('ledgers').doc(transferDetails.fromBankId);
      }

      // Get source ledger data
      const sourceDoc = await transaction.get(sourceRef);

      if (!sourceDoc.exists) {
        throw new Error(`Source ledger not found: ${transferDetails.fromMode}`);
      }

      sourceData = sourceDoc.data();

      // Get destination ledger
      if (transferDetails.toMode === 'cash') {
        const destQuery = db.collection('ledgers')
          .where('firmId', '==', firmIdStr)
          .where('type', '==', 'cash')
          .limit(1);

        const destSnapshot = await transaction.get(destQuery);

        if (destSnapshot.empty) {
          throw new Error('Destination cash ledger not found');
        }

        destRef = destSnapshot.docs[0].ref;
      } else {
        destRef = db.collection('ledgers').doc(transferDetails.toBankId);
      }

      // Get destination ledger data
      const destDoc = await transaction.get(destRef);

      if (!destDoc.exists) {
        throw new Error(`Destination ledger not found: ${transferDetails.toMode}`);
      }

      destData = destDoc.data();

      // Calculate new balances
      newSourceBalance = sourceData.currentBalance - transferAmount;
      newDestBalance = destData.currentBalance + transferAmount;

      // STEP 2: PERFORM ALL WRITES

      // Update source ledger (debit)
      transaction.update(sourceRef, {
        currentBalance: newSourceBalance,
        updatedAt: now
      });

      // Create source transaction record
      const sourceTransactionRef = db.collection('ledgerTransactions').doc();

      transaction.set(sourceTransactionRef, {
        ledgerId: sourceRef.id,
        expenseId,
        date: now,
        description: `Transfer to ${destData.name || 'other account'}`,
        amount: transferAmount,
        type: 'debit',
        balance: newSourceBalance,
        firmId: firmIdStr,
        createdAt: now
      });

      // Update destination ledger (credit)
      transaction.update(destRef, {
        currentBalance: newDestBalance,
        updatedAt: now
      });

      // Create destination transaction record
      const destTransactionRef = db.collection('ledgerTransactions').doc();

      transaction.set(destTransactionRef, {
        ledgerId: destRef.id,
        expenseId,
        date: now,
        description: `Transfer from ${sourceData.name || 'other account'}`,
        amount: transferAmount, // Use positive amount for credit
        type: 'credit',
        balance: newDestBalance,
        firmId: firmIdStr,
        createdAt: now
      });


    });

    return {
      sourceBalance: newSourceBalance,
      destBalance: newDestBalance
    };
  } catch (error) {

    throw error;
  }
}

/**
 * Helper function to create a subs entry
 */
async function createSubsEntry(db, firmId, userId, expenseId, expense) {
  try {
    const subsCollection = db.collection('subs');
    const now = Timestamp.now();

    // Create a new entry in the subs collection
    // For subs, we always store a positive amount (as a receipt) regardless of the original expense amount
    const amountForSub = Math.abs(expense.amount);
    await subsCollection.add({
      date: expense.date,
      paidTo: expense.paidTo,
      amount: amountForSub, // Always positive for subs (as a receipt)
      category: 'RECEIPT', // Always a receipt for the sub
      project: expense.project,
      description: expense.description,
      firmId: firmId.toString(),
      userId,
      parentExpenseId: expenseId,
      createdAt: now,
      updatedAt: now
    });

    // Update the sub's balance
    const subsModelCollection = db.collection('subsModels');
    // Convert firmId to string to avoid ObjectId issues
    const firmIdStr = firmId.toString();

    const subsQuery = subsModelCollection
      .where('firmId', '==', firmIdStr)
      .where('name', '==', expense.paidTo)
      .limit(1);

    const subsSnapshot = await subsQuery.get();

    if (!subsSnapshot.empty) {
      const subsDoc = subsSnapshot.docs[0];
      const sub = subsDoc.data();

      // Update the balance
      // For subs, we're treating payments to subs as positive amounts in their balance
      // So we need to use the absolute value of the expense amount (which is negative for payments)
      const amountForSub = expense.amount < 0 ? Math.abs(expense.amount) : expense.amount;
      await subsDoc.ref.update({
        balance: sub.balance + amountForSub,
        updatedAt: now
      });
    }
  } catch (error) {

    // Don't throw, just log the error to prevent the main transaction from failing
  }
}
