import mongoose from 'mongoose';
import { defineEventHandler, readBody, createError } from 'h3';
import ExpenseModel from '../../../models/expenses/Expense.model';
import LedgerModel from '../../../models/expenses/Ledger.model';
import LedgerTxnModel from '../../../models/expenses/LedgerTxn.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  const body = await readBody(event);
  if (!body || !Array.isArray(body.expenses) || body.expenses.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Provide an array of expenses' });
  }
  if (body.expenses.length > 200) {
    throw createError({ statusCode: 413, statusMessage: 'Too many records (limit 200)' });
  }

  const session = await mongoose.startSession();
  const results: any[] = [];
  try {
    const Expense = ExpenseModel();
    const Ledger = LedgerModel();
    const LedgerTxn = LedgerTxnModel();

    const getOrCreateLedger = async (mode: 'cash' | 'bank', bankId?: string) => {
      const where: any = { firmId: String(firmId) };
      if (mode === 'cash') where.type = 'cash';
      else if (mode === 'bank') where._id = bankId;
      let ledger = await Ledger.findOne(where).session(session);
      if (!ledger && mode === 'cash') {
        ledger = await Ledger.create([
          { name: 'Cash Book', type: 'cash', openingBalance: 0, currentBalance: 0, firmId: String(firmId), userId: String(userId) },
        ], { session }).then((docs) => docs[0]);
      }
      if (!ledger) throw createError({ statusCode: 400, statusMessage: 'Ledger not found' });
      return ledger;
    };

    for (let i = 0; i < body.expenses.length; i += 1) {
      const input = body.expenses[i];
      try {
        // Compute deductions/net
        const hasDeductions = Boolean(input.hasDeductions && Array.isArray(input.deductions) && input.deductions.length > 0);
        const deductions = hasDeductions
          ? input.deductions.map((d: any) => ({ id: d.id || `deduction_${Date.now()}_${Math.random().toString(36).slice(2,9)}`, name: d.name || '', amount: Math.abs(Number(d.amount) || 0), description: d.description || '' }))
          : [];
        const totalDeductions = deductions.reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
        const grossAmount = Number(input.amount);
        const category = input.category || input.transactionType || 'PAYMENT';
        let netAmount = grossAmount;
        if (hasDeductions) netAmount = (category === 'RECEIPT' || grossAmount > 0) ? Math.abs(grossAmount) - totalDeductions : -(Math.abs(grossAmount) - totalDeductions);

        await session.withTransaction(async () => {
          // Create expense
          const createdArr = await Expense.create([
            {
              date: new Date(input.date),
              paidTo: input.paidTo,
              amount: grossAmount,
              category,
              project: input.project || null,
              paymentMode: { type: input.paymentMode?.type, instrumentNo: input.paymentMode?.instrumentNo || null, bankId: input.paymentMode?.bankId || null },
              description: input.description || null,
              paidToGroup: input.paidToGroup || null,
              hasDeductions,
              deductions,
              netAmount,
              firmId: String(firmId),
              userId: String(userId),
              isTransfer: Boolean(input.isTransfer),
              transferDetails: input.transferDetails || null,
            },
          ], { session });
          const expenseDoc: any = createdArr[0];

          if (expenseDoc.isTransfer && expenseDoc.transferDetails) {
            const fromMode = expenseDoc.transferDetails.fromMode as 'cash' | 'bank';
            const toMode = expenseDoc.transferDetails.toMode as 'cash' | 'bank';
            const absAmt = Math.abs(Number(netAmount));
            const fromLedger = await getOrCreateLedger(fromMode, expenseDoc.transferDetails.fromBankId);
            const toLedger = await getOrCreateLedger(toMode, expenseDoc.transferDetails.toBankId);

            const newFromBalance = Number(fromLedger.currentBalance || 0) - absAmt;
            await Ledger.updateOne({ _id: fromLedger._id }, { $set: { currentBalance: newFromBalance, updatedAt: new Date() } }).session(session);
            await LedgerTxn.create([{ ledgerId: String(fromLedger._id), expenseId: String(expenseDoc._id), date: new Date(expenseDoc.date), description: expenseDoc.description || `Transfer to ${toMode}`, amount: absAmt, type: 'debit', balance: newFromBalance, firmId: String(firmId), userId: String(userId), createdAt: new Date(), updatedAt: new Date() }], { session });

            const newToBalance = Number(toLedger.currentBalance || 0) + absAmt;
            await Ledger.updateOne({ _id: toLedger._id }, { $set: { currentBalance: newToBalance, updatedAt: new Date() } }).session(session);
            await LedgerTxn.create([{ ledgerId: String(toLedger._id), expenseId: String(expenseDoc._id), date: new Date(expenseDoc.date), description: expenseDoc.description || `Transfer from ${fromMode}`, amount: absAmt, type: 'credit', balance: newToBalance, firmId: String(firmId), userId: String(userId), createdAt: new Date(), updatedAt: new Date() }], { session });
          } else {
            const mode = expenseDoc.paymentMode?.type as 'cash' | 'bank';
            const ledger = await getOrCreateLedger(mode, expenseDoc.paymentMode?.bankId);
            const newBalance = Number(ledger.currentBalance || 0) + Number(netAmount);
            await Ledger.updateOne({ _id: ledger._id }, { $set: { currentBalance: newBalance, updatedAt: new Date() } }).session(session);
            const isReceipt = Number(netAmount) > 0;
            await LedgerTxn.create([{ ledgerId: String(ledger._id), expenseId: String(expenseDoc._id), date: new Date(expenseDoc.date), description: expenseDoc.description || (isReceipt ? `Receipt from ${expenseDoc.paidTo}` : `Payment to ${expenseDoc.paidTo}`), amount: Math.abs(Number(netAmount)), type: isReceipt ? 'credit' : 'debit', balance: newBalance, firmId: String(firmId), userId: String(userId), createdAt: new Date(), updatedAt: new Date() }], { session });
          }
        });

        results.push({ index: i, success: true });
      } catch (err: any) {
        results.push({ index: i, success: false, error: err?.statusMessage || err?.message || 'Failed' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    return { successCount, failureCount, results };
  } finally {
    session.endSession();
  }
});


