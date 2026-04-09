import { defineEventHandler, createError } from 'h3';
import { SubsModel, SubsTxnModel as SubsTxn } from '../../../models/expenses/Subs.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  const id = (event as any).context.params?.id;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Subs ID is required' });
  const doc = await SubsModel().findOne({ _id: id, firmId: String(firmId) }).lean();
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Subs model not found' });

  // Also load transactions for this sub (fallback by name for legacy imports)
  const orConditions: any[] = [{ subsModelId: String(id) }];
  if (doc.name) orConditions.push({ subName: String(doc.name) });
  const txns = await SubsTxn()
    .find({ firmId: String(firmId), $or: orConditions })
    .sort({ date: -1 })
    .lean();

  const transactions = (txns || []).map((t: any) => ({ ...t, id: String(t._id) }));
  return { ...doc, id: String(doc._id), transactions };
});

