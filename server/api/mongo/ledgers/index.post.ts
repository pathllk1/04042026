import { defineEventHandler, readBody, createError } from 'h3';
import LedgerModel from '../../../models/expenses/Ledger.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const body = await readBody(event);
  if (!body?.name || !body?.type) throw createError({ statusCode: 400, statusMessage: 'Missing required fields: name, type' });
  const doc = await LedgerModel().create({
    name: body.name,
    type: body.type,
    openingBalance: Number(body.openingBalance || 0),
    currentBalance: Number(body.openingBalance || 0),
    bankDetails: body.bankDetails || {},
    firmId: String(firmId),
    userId: String(userId)
  });
  const obj = doc.toObject();
  return { ...obj, id: String(doc._id) };
});

