import mongoose from 'mongoose';
import { defineEventHandler, createError } from 'h3';
import { SubsModel, SubsTxnModel as SubsTxn } from '../../../../models/expenses/Subs.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  const id = (event as any).context.params?.id;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Transaction ID is required' });
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    const txn = await SubsTxn().findOne({ _id: id, firmId: String(firmId) }).session(session);
    if (!txn) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' });
    const subs = await SubsModel().findOne({ _id: txn.subsModelId, firmId: String(firmId) }).session(session);
    if (!subs) throw createError({ statusCode: 404, statusMessage: 'Subs model not found' });
    await SubsTxn().deleteOne({ _id: id }).session(session);
    await SubsModel().updateOne({ _id: txn.subsModelId }, { $inc: { balance: -Number(txn.amount) }, $set: { updatedAt: new Date() } }).session(session);
  });
  session.endSession();
  return { success: true, id: String(id) };
});

