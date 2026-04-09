import { defineEventHandler, createError } from 'h3';
import { SubsModel } from '../../../models/expenses/Subs.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  const id = (event as any).context.params?.id;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Subs ID is required' });
  const doc = await SubsModel().findOneAndDelete({ _id: id, firmId: String(firmId) }).lean();
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Subs model not found' });
  return { success: true, id: String(id) };
});

