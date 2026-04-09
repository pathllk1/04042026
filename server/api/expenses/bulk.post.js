import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Bulk create expenses (Multiple Payments)
 *
 * POST /api/expenses/bulk
 * Body: { expenses: ExpenseInput[] }
 *
 * Notes
 * - Uses the same collections as single-expense API:
 *   expenses, ledgers, ledgerTransactions, subs, subsModels
 * - Applies the same validation and ledger update rules per item
 * - Each item is processed independently; returns per-item results
 */
export default defineEventHandler(async (event) => {
  // Auth + firm scope
  const userId = event.context.userId;
  const firmId = event.context.user?.firmId;
  if (!userId || !firmId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  // Parse body
  const body = await readBody(event);
  if (!body || !Array.isArray(body.expenses) || body.expenses.length === 0) {
    throw createError({ statusCode: 400, message: 'Provide an array of expenses' });
  }

  // Simple safety cap
  if (body.expenses.length > 200) {
    throw createError({ statusCode: 413, message: 'Too many records (limit 200)' });
  }

  const db = getFirestore();
  const expensesCollection = db.collection('expenses');

  const results = [];

  // Process sequentially to preserve ordering and simplify ledger race conditions
  for (let i = 0; i < body.expenses.length; i += 1) {
    const input = body.expenses[i];
    try {
      // Validate minimal fields
      if (!input?.date || !input?.paidTo || input.amount === undefined || !input?.paymentMode?.type) {
        throw createError({ statusCode: 400, message: `Item ${i + 1}: Missing required fields` });
      }
      if (input.paymentMode.type === 'bank' && !input.paymentMode.instrumentNo) {
        throw createError({ statusCode: 400, message: `Item ${i + 1}: Instrument number required for bank payments` });
      }

      // Normalize + compute deductions similar to single create API
      let processedDeductions = [];
      let totalDeductions = 0;
      let netAmount = Number(input.amount);
      if (input.hasDeductions && Array.isArray(input.deductions)) {
        processedDeductions = input.deductions.map((d) => ({
          id: d.id || `deduction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: d.name || '',
          amount: Math.abs(Number(d.amount) || 0),
          description: d.description || '',
        }));
        totalDeductions = processedDeductions.reduce((sum, d) => sum + d.amount, 0);
        if (input.category === 'RECEIPT' || Number(input.amount) > 0) {
          netAmount = Number(input.amount) - totalDeductions;
        } else {
          netAmount = Number(input.amount) + totalDeductions;
        }
      }

      // Optional: upsert party details captured from edit modal
      try {
        const providedPartyDetails = input.partyDetails || input.details || input._details;
        if (providedPartyDetails || input.paidTo) {
          await upsertExpenseParty(
            db,
            firmId,
            userId,
            sanitizePartyDetails(providedPartyDetails, input.paidTo)
          );
        }
      } catch (e) {
        // Do not fail the expense creation if party upsert fails
      }

      const now = Timestamp.now();
      const newExpense = {
        date: Timestamp.fromDate(new Date(input.date)),
        paidTo: input.paidTo,
        amount: Number(input.amount),
        category: input.category || 'PAYMENT',
        project: input.project || null,
        paymentMode: {
          type: input.paymentMode.type,
          instrumentNo: input.paymentMode.instrumentNo || null,
          bankId: input.paymentMode.bankId || null,
        },
        description: input.description || null,
        paidToGroup: input.paidToGroup || null,
        hasDeductions: !!input.hasDeductions,
        deductions: processedDeductions,
        netAmount,
        firmId: firmId.toString(),
        userId: userId.toString(),
        isTransfer: !!input.isTransfer,
        transferDetails: input.transferDetails || null,
        createdAt: now,
        updatedAt: now,
      };

      // Prepare a new doc id first
      const docRef = expensesCollection.doc();
      const expenseWithId = { ...newExpense, id: docRef.id };

      // For transfers, follow the same special handling
      if (newExpense.isTransfer && newExpense.transferDetails) {
        await docRef.set(expenseWithId);
        await handleTransfer(db, firmId, newExpense.transferDetails, newExpense.netAmount, docRef.id);
      } else {
        // Run a transaction for each non-transfer expense
        await db.runTransaction(async (transaction) => {
          let ledgerRef;

          if (newExpense.paymentMode.type === 'cash') {
            const ledgerQuery = db
              .collection('ledgers')
              .where('firmId', '==', firmId.toString())
              .where('type', '==', 'cash')
              .limit(1);
            const snapshot = await transaction.get(ledgerQuery);
            if (snapshot.empty) throw new Error('Cash ledger not found');
            ledgerRef = snapshot.docs[0].ref;
          } else {
            ledgerRef = db.collection('ledgers').doc(newExpense.paymentMode.bankId);
          }

          const ledgerDoc = await transaction.get(ledgerRef);
          if (!ledgerDoc.exists) throw new Error(`Ledger not found: ${newExpense.paymentMode.type}`);
          const ledgerData = ledgerDoc.data();

          const netAmountForLedger = newExpense.netAmount;
          const newBalance = ledgerData.currentBalance + netAmountForLedger;
          const isReceipt = netAmountForLedger > 0;

          // Writes
          transaction.set(docRef, expenseWithId);
          transaction.update(ledgerRef, { currentBalance: newBalance, updatedAt: Timestamp.now() });

          const ledgerTxRef = db.collection('ledgerTransactions').doc();
          transaction.set(ledgerTxRef, {
            ledgerId: ledgerRef.id,
            expenseId: docRef.id,
            date: newExpense.date,
            description: isReceipt
              ? `Receipt from ${newExpense.paidTo}${newExpense.hasDeductions ? ' (net after deductions)' : ''}`
              : `Payment to ${newExpense.paidTo}${newExpense.hasDeductions ? ' (net after deductions)' : ''}`,
            amount: Math.abs(netAmountForLedger),
            type: isReceipt ? 'credit' : 'debit',
            balance: newBalance,
            firmId: firmId.toString(),
            createdAt: Timestamp.now(),
          });
        });
      }

      // Optional: auto-create subs entry if asked by grouping
      if (newExpense.paidToGroup === 'subs' && !input.createSubsEntry) {
        await createSubsEntry(db, firmId, userId, docRef.id, expenseWithId);
      }

      results.push({ index: i, success: true, id: docRef.id });
    } catch (err) {
      const message = err?.statusMessage || err?.message || 'Unknown error';
      results.push({ index: i, success: false, error: message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;
  return { successCount, failureCount, results };
});

// Reuse helpers from single-expense API (copied for isolation). Keep behavior identical.
async function handleTransfer(db, firmId, transferDetails, amount, expenseId) {
  const firmIdStr = firmId.toString();
  const now = Timestamp.now();
  const transferAmount = Math.abs(amount);

  let sourceRef, sourceData, destRef, destData;
  let newSourceBalance, newDestBalance;

  await db.runTransaction(async (transaction) => {
    // Source
    if (transferDetails.fromMode === 'cash') {
      const sourceQuery = db
        .collection('ledgers')
        .where('firmId', '==', firmIdStr)
        .where('type', '==', 'cash')
        .limit(1);
      const sourceSnapshot = await transaction.get(sourceQuery);
      if (sourceSnapshot.empty) throw new Error('Source cash ledger not found');
      sourceRef = sourceSnapshot.docs[0].ref;
    } else {
      sourceRef = db.collection('ledgers').doc(transferDetails.fromBankId);
    }
    const sourceDoc = await transaction.get(sourceRef);
    if (!sourceDoc.exists) throw new Error(`Source ledger not found: ${transferDetails.fromMode}`);
    sourceData = sourceDoc.data();

    // Destination
    if (transferDetails.toMode === 'cash') {
      const destQuery = db
        .collection('ledgers')
        .where('firmId', '==', firmIdStr)
        .where('type', '==', 'cash')
        .limit(1);
      const destSnapshot = await transaction.get(destQuery);
      if (destSnapshot.empty) throw new Error('Destination cash ledger not found');
      destRef = destSnapshot.docs[0].ref;
    } else {
      destRef = db.collection('ledgers').doc(transferDetails.toBankId);
    }
    const destDoc = await transaction.get(destRef);
    if (!destDoc.exists) throw new Error(`Destination ledger not found: ${transferDetails.toMode}`);
    destData = destDoc.data();

    // New balances
    newSourceBalance = sourceData.currentBalance - transferAmount;
    newDestBalance = destData.currentBalance + transferAmount;

    // Writes
    transaction.update(sourceRef, { currentBalance: newSourceBalance, updatedAt: now });
    const sourceTx = db.collection('ledgerTransactions').doc();
    transaction.set(sourceTx, {
      ledgerId: sourceRef.id,
      expenseId,
      date: now,
      description: `Transfer to ${destData.name || 'other account'}`,
      amount: transferAmount,
      type: 'debit',
      balance: newSourceBalance,
      firmId: firmIdStr,
      createdAt: now,
    });

    transaction.update(destRef, { currentBalance: newDestBalance, updatedAt: now });
    const destTx = db.collection('ledgerTransactions').doc();
    transaction.set(destTx, {
      ledgerId: destRef.id,
      expenseId,
      date: now,
      description: `Transfer from ${sourceData.name || 'other account'}`,
      amount: transferAmount,
      type: 'credit',
      balance: newDestBalance,
      firmId: firmIdStr,
      createdAt: now,
    });
  });

  return { sourceBalance: newSourceBalance, destBalance: newDestBalance };
}

async function createSubsEntry(db, firmId, userId, expenseId, expense) {
  try {
    const subsCollection = db.collection('subs');
    const now = Timestamp.now();
    const amountForSub = Math.abs(expense.amount);
    await subsCollection.add({
      date: expense.date,
      paidTo: expense.paidTo,
      amount: amountForSub,
      category: 'RECEIPT',
      project: expense.project,
      description: expense.description,
      firmId: firmId.toString(),
      userId: userId.toString(),
      parentExpenseId: expenseId,
      createdAt: now,
      updatedAt: now,
    });

    // Update sub model balance if exists
    const subsModelCollection = db.collection('subsModels');
    const firmIdStr = firmId.toString();
    const subsQuery = subsModelCollection
      .where('firmId', '==', firmIdStr)
      .where('name', '==', expense.paidTo)
      .limit(1);
    const subsSnapshot = await subsQuery.get();
    if (!subsSnapshot.empty) {
      const subsDoc = subsSnapshot.docs[0];
      const sub = subsDoc.data();
      const amountForSubModel = expense.amount < 0 ? Math.abs(expense.amount) : expense.amount;
      await subsDoc.ref.update({ balance: sub.balance + amountForSubModel, updatedAt: now });
    }
  } catch (err) {
    // Intentionally swallow to avoid failing the whole bulk op
  }
}

// Upsert into expenseParties collection by (firmId, name)
async function upsertExpenseParty(db, firmId, userId, party) {
  if (!party || !party.name) return null;
  const collection = db.collection('expenseParties');
  const firmIdStr = firmId.toString();
  const now = Timestamp.now();

  // Check duplicate by name in firm
  const dup = await collection
    .where('firmId', '==', firmIdStr)
    .where('name', '==', party.name)
    .limit(1)
    .get();

  const payload = {
    name: party.name,
    address: party.address || '',
    gstin: party.gstin ? String(party.gstin).toUpperCase() : '',
    state: party.state || '',
    pin: party.pin ? String(party.pin) : '',
    pan: party.pan ? String(party.pan).toUpperCase() : '',
    contact: party.contact || '',
    bankDetails: {
      bankName: party.bankDetails?.bankName || party.bankName || '',
      accountNumber: party.bankDetails?.accountNumber || party.accountNumber || '',
      ifscCode: party.bankDetails?.ifscCode
        ? String(party.bankDetails.ifscCode).toUpperCase()
        : party.ifscCode
        ? String(party.ifscCode).toUpperCase()
        : '',
      branch: party.bankDetails?.branch || party.branch || '',
      accountHolderName: party.bankDetails?.accountHolderName || party.accountHolderName || party.name || ''
    },
    firmId: firmIdStr,
    userId: userId.toString(),
    updatedAt: now,
  };

  if (dup.empty) {
    // create
    await collection.add({ ...payload, createdAt: now });
  } else {
    await dup.docs[0].ref.update(payload);
  }

  return true;
}

function sanitizePartyDetails(details, paidTo) {
  const d = details || {};
  const name = (d.name || paidTo || '').toString().trim();
  if (!name) return null;
  return {
    name,
    address: d.address || '',
    gstin: d.gstin || '',
    state: d.state || '',
    pin: d.pin || '',
    pan: d.pan || '',
    contact: d.contact || '',
    bankDetails: {
      bankName: d.bankDetails?.bankName || d.bankName || '',
      accountNumber: d.bankDetails?.accountNumber || d.accountNumber || '',
      ifscCode: d.bankDetails?.ifscCode || d.ifscCode || '',
      branch: d.bankDetails?.branch || d.branch || '',
      accountHolderName: d.bankDetails?.accountHolderName || d.accountHolderName || name,
    },
  };
}


