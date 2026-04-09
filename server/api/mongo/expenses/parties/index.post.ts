import { defineEventHandler, readBody, createError } from 'h3';
import ExpensePartyModel from '../../../../models/expenses/ExpenseParty.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  const body = await readBody(event);
  if (!body?.name) throw createError({ statusCode: 400, statusMessage: 'Name is required' });

  const Party = ExpensePartyModel();
  const doc = await Party.create({
    name: String(body.name).trim(),
    address: body.address || '',
    gstin: (body.gstin || '').toUpperCase(),
    state: body.state || '',
    pin: body.pin ? String(body.pin) : '',
    pan: (body.pan || '').toUpperCase(),
    contact: body.contact || '',
    bankDetails: body.bankDetails || {},
    firmId: String(firmId),
    userId: String(userId),
  });

  return { id: String(doc._id), ...doc.toObject() };
});
