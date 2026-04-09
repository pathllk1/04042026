import { defineEventHandler, getQuery, createError } from 'h3';
import ExpenseModel from '../../../models/expenses/Expense.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;

  if (!userId || !firmId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  try {
    const query = getQuery(event);
    const where: any = { firmId: String(firmId) };

    if (query.startDate) {
      where.date = where.date || {};
      where.date.$gte = new Date(String(query.startDate));
    }
    if (query.endDate) {
      where.date = where.date || {};
      where.date.$lte = new Date(String(query.endDate));
    }
    if (query.paidTo) where.paidTo = String(query.paidTo);
    if (query.category) where.category = String(query.category);
    if (query.project) where.project = String(query.project);
    if (query.paidToGroup) where.paidToGroup = String(query.paidToGroup);
    if (query.isTransfer !== undefined) where.isTransfer = String(query.isTransfer) === 'true';
    if (query.paymentMode) where['paymentMode.type'] = String(query.paymentMode);

    const Expense = ExpenseModel();
    const docs = await Expense.find(where).sort({ date: -1 }).lean();

    return docs.map((d: any) => ({
      id: String(d._id),
      paidTo: d.paidTo,
      amount: d.amount,
      category: d.category,
      project: d.project,
      paymentMode: d.paymentMode,
      description: d.description,
      paidToGroup: d.paidToGroup,
      hasDeductions: d.hasDeductions,
      deductions: d.deductions || [],
      netAmount: d.netAmount ?? d.amount,
      isTransfer: d.isTransfer || false,
      transferDetails: d.transferDetails || null,
      date: d.date ? new Date(d.date).toISOString() : null,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null
    }));
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Failed to fetch expenses' });
  }
});




