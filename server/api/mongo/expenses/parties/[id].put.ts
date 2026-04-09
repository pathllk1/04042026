import { defineEventHandler, readBody, createError } from 'h3';
import ExpensePartyModel from '../../../../models/expenses/ExpenseParty.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  const id = (event as any).context.params?.id;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Party ID is required' });

  const body = await readBody(event);
  const Party = ExpensePartyModel();
  const existing = await Party.findOne({ _id: id, firmId: String(firmId) });
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Party not found' });

  const update: any = {
    name: body?.name ? String(body.name).trim() : existing.name,
    address: body?.address ?? existing.address,
    gstin: body?.gstin ? String(body.gstin).toUpperCase() : existing.gstin,
    state: body?.state ?? existing.state,
    pin: body?.pin !== undefined ? String(body.pin) : existing.pin,
    pan: body?.pan ? String(body.pan).toUpperCase() : existing.pan,
    contact: body?.contact ?? existing.contact,
    bankDetails: body?.bankDetails ?? existing.bankDetails,
    updatedAt: new Date(),
  };

  await Party.updateOne({ _id: id }, { $set: update });
  const doc: any = await Party.findById(id).lean();
  return { id: String(doc._id), ...doc };
});
