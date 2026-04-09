import { defineEventHandler, readBody, createError } from 'h3';
import { SubsModel } from '../../../models/expenses/Subs.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const body = await readBody(event);
  if (!body.name) throw createError({ statusCode: 400, statusMessage: 'Missing required field: name' });
  const doc = await SubsModel().create({
    ...body,
    firmId: String(firmId),
    userId: String(userId),
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return { ...doc.toObject(), id: String(doc._id) };
});

