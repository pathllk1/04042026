import mongoose from 'mongoose';
import { defineEventHandler, getQuery, createError, setHeader } from 'h3';
import { generatePDFReport } from '../../../../utils/pdfReportGenerator';

const ExpenseSchema = new mongoose.Schema({}, { strict: false });
const Expense = () => mongoose.models.ExpenseMongo || mongoose.model('ExpenseMongo', ExpenseSchema, 'expenses');

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  const q = getQuery(event);
  const where: any = { firmId: String(firmId) };
  if (q.startDate) { where.date = where.date || {}; where.date.$gte = new Date(String(q.startDate)); }
  if (q.endDate) { where.date = where.date || {}; where.date.$lte = new Date(String(q.endDate)); }
  if (q.paidTo) where.paidTo = String(q.paidTo);
  if (q.category) where.category = String(q.category);
  if (q.project) where.project = String(q.project);
  if (q.paidToGroup) where.paidToGroup = String(q.paidToGroup);
  if (q.isTransfer !== undefined) where.isTransfer = String(q.isTransfer) === 'true';
  if (q.paymentMode) where['paymentMode.type'] = String(q.paymentMode);

  const docs = await Expense().find(where).lean();

  // Build summary and flat data for PDF generator
  let totalExpenses = 0;
  let totalReceipts = 0;
  const data = docs
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((d: any) => {
      const amt = Number(d.netAmount ?? d.amount ?? 0);
      if (amt < 0) totalExpenses += Math.abs(amt);
      else totalReceipts += amt;
      return {
        date: d.date,
        paidTo: d.paidTo,
        category: d.category,
        paymentMode: d.paymentMode?.type || 'cash',
        description: d.description || '',
        amount: amt
      };
    });

  const reportPayload: any = {
    reportType: String(q.type || 'date-range'),
    timePeriod: q.timePeriod ? String(q.timePeriod) : undefined,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount: totalReceipts - totalExpenses
    },
    data
  };

  const buffer = await generatePDFReport(reportPayload);
  setHeader(event, 'Content-Type', 'application/pdf');
  setHeader(event, 'Content-Disposition', `attachment; filename="expenses_${Date.now()}.pdf"`);
  return buffer;
});

