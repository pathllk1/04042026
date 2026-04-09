import { defineEventHandler, readBody, createError } from 'h3';
import PTG from '../../../models/expenses/PaidToGroup.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const body = await readBody(event);
  if (!body?.name) throw createError({ statusCode: 400, statusMessage: 'Missing required field: name' });
  const doc = await PTG().create({
    name: String(body.name),
    description: String(body.description || ''),
    firmId: String(firmId),
    userId: String(userId),
    isActive: body.isActive !== false
  });
  return { ...doc.toObject(), id: String(doc._id) };
});

