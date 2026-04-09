import mongoose from 'mongoose';
import { defineEventHandler, createError } from 'h3';
import ExpenseModel from '../../../models/expenses/Expense.model';
import LedgerModel from '../../../models/expenses/Ledger.model';
import LedgerTxnModel from '../../../models/expenses/LedgerTxn.model';

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

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const Expense = ExpenseModel();
      const Ledger = LedgerModel();
      const LedgerTxn = LedgerTxnModel();

      const existing: any = await Expense.findOne({ _id: id, firmId: String(firmId) }).session(session).lean();
      if (!existing) throw createError({ statusCode: 404, statusMessage: 'Expense not found' });

      // Reverse ledger impacts: find all txns for this expense and invert their effect
      const txns: any[] = await LedgerTxn.find({ expenseId: String(id), firmId: String(firmId) }).session(session).lean();
      for (const t of txns) {
        const ledger = await Ledger.findOne({ _id: t.ledgerId, firmId: String(firmId) }).session(session);
        if (!ledger) continue;
        let newBalance = Number(ledger.currentBalance || 0);
        if (t.type === 'credit') newBalance -= Number(t.amount || 0);
        else if (t.type === 'debit') newBalance += Number(t.amount || 0);
        await Ledger.updateOne({ _id: ledger._id }, { $set: { currentBalance: newBalance, updatedAt: new Date() } }).session(session);
      }
      if (txns.length > 0) {
        await LedgerTxn.deleteMany({ expenseId: String(id), firmId: String(firmId) }).session(session);
      }

      await Expense.deleteOne({ _id: id }).session(session);
      result = { message: 'Expense deleted successfully' };
    });
    return result;
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Failed to delete expense' });
  } finally {
    session.endSession();
  }
});




