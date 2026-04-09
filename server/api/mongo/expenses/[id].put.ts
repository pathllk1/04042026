import mongoose from 'mongoose';
import { defineEventHandler, readBody, createError } from 'h3';
import ExpenseModel from '../../../models/expenses/Expense.model';
import LedgerModel from '../../../models/expenses/Ledger.model';
import LedgerTxnModel from '../../../models/expenses/LedgerTxn.model';

// Minimal models for ledger + ledger transactions
const LedgerSchema = new mongoose.Schema({}, { strict: false });
const LedgerModel = () => mongoose.models.LedgerMongo || mongoose.model('LedgerMongo', LedgerSchema, 'ledgers');

const LedgerTxnSchema = new mongoose.Schema({}, { strict: false });
const LedgerTxnModel = () =>
  mongoose.models.LedgerTxnMongo || mongoose.model('LedgerTxnMongo', LedgerTxnSchema, 'ledgerTransactions');

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  const id = (event as any).context.params?.id;

  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Expense ID is required' });

  const body = await readBody(event);

  // Compute deductions and net if provided
  let updateData: any = { ...body, updatedAt: new Date() };
  if (body?.date) updateData.date = new Date(body.date);
  if (body?.hasDeductions !== undefined) {
    const hasDeductions = Boolean(body.hasDeductions && Array.isArray(body.deductions) && body.deductions.length > 0);
    const deductions = hasDeductions
      ? body.deductions.map((d: any) => ({
          id: d.id || `deduction_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          name: d.name || '',
          amount: Math.abs(Number(d.amount) || 0),
          description: d.description || ''
        }))
      : [];
    const totalDeductions = deductions.reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
    const grossAmount = body.amount !== undefined ? Number(body.amount) : undefined;
    const category = body.category;
    let netAmount: number | undefined = undefined;
    if (grossAmount !== undefined) {
      if (category === 'RECEIPT' || grossAmount > 0) netAmount = Math.abs(grossAmount) - totalDeductions;
      else netAmount = -(Math.abs(grossAmount) - totalDeductions);
    }
    updateData.hasDeductions = hasDeductions;
    updateData.deductions = deductions;
    if (netAmount !== undefined) updateData.netAmount = netAmount;
  }

  // Validate paymentMode if provided
  if (body?.paymentMode?.type === 'bank' && !body?.paymentMode?.instrumentNo) {
    throw createError({ statusCode: 400, statusMessage: 'Instrument number is required for bank payments' });
  }

  const session = await mongoose.startSession();
  try {
    let updated: any;
    await session.withTransaction(async () => {
      const Expense = ExpenseModel();
      const Ledger = LedgerModel();
      const LedgerTxn = LedgerTxnModel();

      const existing: any = await Expense.findOne({ _id: id, firmId: String(firmId) }).session(session);
      if (!existing) throw createError({ statusCode: 404, statusMessage: 'Expense not found' });

      // 1) Reverse previous ledger impact by removing its ledgerTransactions and adjusting ledgers
      const prevTxns: any[] = await LedgerTxn.find({ expenseId: String(id), firmId: String(firmId) }).session(session).lean();
      for (const t of prevTxns) {
        const ledger = await Ledger.findOne({ _id: t.ledgerId, firmId: String(firmId) }).session(session);
        if (ledger) {
          let newBalance = Number(ledger.currentBalance || 0);
          if (t.type === 'credit') newBalance -= Number(t.amount || 0);
          else if (t.type === 'debit') newBalance += Number(t.amount || 0);
          await Ledger.updateOne({ _id: ledger._id }, { $set: { currentBalance: newBalance, updatedAt: new Date() } }).session(session);
        }
      }
      if (prevTxns.length > 0) {
        await LedgerTxn.deleteMany({ expenseId: String(id), firmId: String(firmId) }).session(session);
      }

      // 2) Update the expense document itself
      await Expense.updateOne({ _id: id }, { $set: updateData }).session(session);
      updated = await Expense.findById(id).session(session);

      // 3) Re-apply ledger impact like create
      const computeNetFromDoc = (doc: any) => Number(doc.netAmount ?? doc.amount ?? 0);
      const amountToPost = computeNetFromDoc(updated);

      const getOrCreateLedger = async (mode: 'cash' | 'bank', bankId?: string) => {
        const where: any = { firmId: String(firmId) };
        if (mode === 'cash') where.type = 'cash';
        else if (mode === 'bank') where._id = bankId;
        else throw createError({ statusCode: 400, statusMessage: 'Unsupported payment mode' });

        let ledger = await Ledger.findOne(where).session(session);
        if (!ledger && mode === 'cash') {
          ledger = await Ledger.create([
            {
              name: 'Cash Book',
              type: 'cash',
              openingBalance: 0,
              currentBalance: 0,
              description: 'Default cash book for all cash transactions',
              firmId: String(firmId),
              userId: String(userId),
            },
          ], { session }).then((docs) => docs[0]);
        }
        if (!ledger) throw createError({ statusCode: 400, statusMessage: 'Ledger not found' });
        return ledger;
      };

      if (updated.isTransfer && updated.transferDetails) {
        const fromMode = updated.transferDetails.fromMode as 'cash' | 'bank';
        const toMode = updated.transferDetails.toMode as 'cash' | 'bank';
        const fromBankId = updated.transferDetails.fromBankId;
        const toBankId = updated.transferDetails.toBankId;
        const absAmt = Math.abs(Number(amountToPost));

        const fromLedger = await getOrCreateLedger(fromMode, fromBankId);
        const toLedger = await getOrCreateLedger(toMode, toBankId);

        const newFromBalance = Number(fromLedger.currentBalance || 0) - absAmt;
        await Ledger.updateOne({ _id: fromLedger._id }, { $set: { currentBalance: newFromBalance, updatedAt: new Date() } }).session(session);
        await LedgerTxn.create([
          {
            ledgerId: String(fromLedger._id),
            expenseId: String(id),
            date: new Date(updated.date),
            description: updated.description || `Transfer to ${toMode === 'bank' ? 'Bank' : 'Cash'}`,
            amount: absAmt,
            type: 'debit',
            balance: newFromBalance,
            firmId: String(firmId),
            userId: String(userId),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ], { session });

        const newToBalance = Number(toLedger.currentBalance || 0) + absAmt;
        await Ledger.updateOne({ _id: toLedger._id }, { $set: { currentBalance: newToBalance, updatedAt: new Date() } }).session(session);
        await LedgerTxn.create([
          {
            ledgerId: String(toLedger._id),
            expenseId: String(id),
            date: new Date(updated.date),
            description: updated.description || `Transfer from ${fromMode === 'bank' ? 'Bank' : 'Cash'}`,
            amount: absAmt,
            type: 'credit',
            balance: newToBalance,
            firmId: String(firmId),
            userId: String(userId),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ], { session });
      } else {
        const mode = updated.paymentMode?.type as 'cash' | 'bank';
        const bankId = updated.paymentMode?.bankId as string | undefined;
        const ledger = await getOrCreateLedger(mode, bankId);

        const newBalance = Number(ledger.currentBalance || 0) + Number(amountToPost);
        await Ledger.updateOne({ _id: ledger._id }, { $set: { currentBalance: newBalance, updatedAt: new Date() } }).session(session);
        const isReceipt = Number(amountToPost) > 0;
        await LedgerTxn.create([
          {
            ledgerId: String(ledger._id),
            expenseId: String(id),
            date: new Date(updated.date),
            description: updated.description || (isReceipt ? `Receipt from ${updated.paidTo}` : `Payment to ${updated.paidTo}`),
            amount: Math.abs(Number(amountToPost)),
            type: isReceipt ? 'credit' : 'debit',
            balance: newBalance,
            firmId: String(firmId),
            userId: String(userId),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ], { session });
      }
    });

    return {
      id: String(updated?._id || id),
      ...updated?.toObject?.() ?? updated,
      date: updated?.date ? new Date(updated.date).toISOString() : null,
      createdAt: updated?.createdAt ? new Date(updated.createdAt).toISOString() : null,
      updatedAt: updated?.updatedAt ? new Date(updated.updatedAt).toISOString() : null,
    };
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Failed to update expense' });
  } finally {
    session.endSession();
  }
});


