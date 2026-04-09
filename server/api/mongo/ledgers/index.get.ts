import { defineEventHandler, getQuery, createError } from 'h3';
import LedgerModel from '../../../models/expenses/Ledger.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  const q = getQuery(event);
  const where: any = { firmId: String(firmId) };
  if (q.type) where.type = String(q.type);

  const Ledger = LedgerModel();
  const docs = await Ledger.find(where).sort({ name: 1 }).lean();
  return docs.map((d: any) => ({
    id: String(d._id),
    ...d,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null
  }));
});



