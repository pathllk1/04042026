import { defineEventHandler, createError } from 'h3';
import Ledger from '../../../models/expenses/Ledger.model';
import LedgerTxn from '../../../models/expenses/LedgerTxn.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  const id = (event as any).context.params?.id;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Ledger ID is required' });

  const doc: any = await Ledger().findOne({ _id: id, firmId: String(firmId) }).lean();
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Ledger not found' });

  // Fetch transactions for this ledger from Mongo, sorted chronologically
  const txns: any[] = await LedgerTxn()
    .find({ ledgerId: String(id), firmId: String(firmId) })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  const transactions = (txns || []).map((t: any) => ({
    id: String(t._id),
    ledgerId: String(t.ledgerId),
    expenseId: t.expenseId ? String(t.expenseId) : null,
    date: t.date ? new Date(t.date).toISOString() : null,
    description: t.description || '',
    amount: Number(t.amount || 0),
    type: t.type === 'credit' ? 'credit' : 'debit',
    balance: Number(t.balance || 0),
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
    updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
  }));

  return {
    ...doc,
    id: String(doc._id),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    transactions,
  };
});

