import { defineEventHandler, getQuery, createError } from 'h3';
import ExpensePartyModel from '../../../../models/expenses/ExpenseParty.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  const q = getQuery(event);
  const nameQ = String(q.q || '').trim().toLowerCase();

  const Party = ExpensePartyModel();
  const where: any = { firmId: String(firmId) };
  if (nameQ) where.name = { $regex: nameQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const docs = await Party.find(where).sort({ name: 1 }).limit(50).lean();
  return docs.map((d: any) => ({
    id: String(d._id),
    name: d.name,
    address: d.address,
    gstin: d.gstin,
    state: d.state,
    pin: d.pin,
    pan: d.pan,
    contact: d.contact,
    bankDetails: d.bankDetails || {},
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  }));
});
