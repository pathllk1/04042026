import { defineEventHandler, createError } from 'h3';
import PTG from '../../../models/expenses/PaidToGroup.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  const id = (event as any).context.params?.id;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' });
  const doc = await PTG().findOne({ _id: id, firmId: String(firmId) }).lean();
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Not found' });
  return { ...doc, id: String(doc._id) };
});

