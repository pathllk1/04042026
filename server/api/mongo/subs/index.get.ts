import { defineEventHandler, getQuery, createError } from 'h3';
import { SubsModel } from '../../../models/expenses/Subs.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const q = getQuery(event);
  const where: any = { firmId: String(firmId) };
  if (q.isActive !== undefined) where.isActive = q.isActive === 'true' || q.isActive === true;
  const subs = await SubsModel().find(where).sort({ name: 1 }).lean();
  return subs.map(doc => ({ ...doc, id: String(doc._id) }));
});

