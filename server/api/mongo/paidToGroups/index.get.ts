import { defineEventHandler, getQuery, createError } from 'h3';
import PTG from '../../../models/expenses/PaidToGroup.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const q = getQuery(event);
  const where: any = { firmId: String(firmId) };
  if (q.isActive !== undefined) where.isActive = String(q.isActive) === 'true';
  const docs = await PTG().find(where).sort({ name: 1 }).lean();
  return docs.map(d => ({ ...d, id: String(d._id) }));
});

