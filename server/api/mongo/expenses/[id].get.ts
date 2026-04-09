import mongoose from 'mongoose';
import { defineEventHandler, createError } from 'h3';

const ExpenseSchema = new mongoose.Schema({},{ strict: false });
const ExpenseModel = () =>
  mongoose.models.ExpenseMongo || mongoose.model('ExpenseMongo', ExpenseSchema, 'expenses');

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  const id = (event as any).context.params?.id;

  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Expense ID is required' });

  try {
    const Expense = ExpenseModel();
    const doc: any = await Expense.findOne({ _id: id, firmId: String(firmId) }).lean();
    if (!doc) throw createError({ statusCode: 404, statusMessage: 'Expense not found' });

    return {
      id: String(doc._id),
      ...doc,
      date: doc.date ? new Date(doc.date).toISOString() : null,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null
    };
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Failed to fetch expense' });
  }
});


