import mongoose from 'mongoose';
import { defineEventHandler, readBody, createError } from 'h3';
import { SubsModel, SubsTxnModel as SubsTxn } from '../../../../models/expenses/Subs.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const body = await readBody(event);
  if (!body.subsModelId || !body.amount || !body.date || !body.paidTo) throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
  const session = await mongoose.startSession();
  let txnDoc;
  await session.withTransaction(async () => {
    const subs = await SubsModel().findOne({ _id: body.subsModelId, firmId: String(firmId) }).session(session);
    if (!subs) throw createError({ statusCode: 404, statusMessage: 'Subs model not found' });
    const newBalance = (subs.balance || 0) + Number(body.amount);
    txnDoc = await SubsTxn().create([{ ...body, firmId: String(firmId), userId: String(userId), createdAt: new Date(), updatedAt: new Date() }], { session });
    await SubsModel().updateOne({ _id: body.subsModelId }, { $set: { balance: newBalance, updatedAt: new Date() } }).session(session);
  });
  session.endSession();
  return { ...txnDoc[0].toObject(), id: String(txnDoc[0]._id) };
});

