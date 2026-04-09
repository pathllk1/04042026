import { defineEventHandler, getQuery, createError, setHeader } from 'h3';
import { generateExcelReport } from '../../../../utils/excelReportGenerator';
import { SubsModel, SubsTxnModel as SubsTxn } from '../../../../models/expenses/Subs.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  const q = getQuery(event);
  const where: any = { firmId: String(firmId) };

  // Support both subsModelId and subName; also handle legacy docs that stored subName
  const orConditions: any[] = [];
  let resolvedSubName: string | undefined;
  if (q.subsModelId) orConditions.push({ subsModelId: String(q.subsModelId) });
  if (q.subName) {
    resolvedSubName = String(q.subName);
    orConditions.push({ subName: resolvedSubName });
    try {
      const subDoc = await SubsModel().findOne({ firmId: String(firmId), name: resolvedSubName }).lean();
      if (subDoc?._id) {
        orConditions.push({ subsModelId: String(subDoc._id) });
      }
    } catch {}
  }
  if (orConditions.length > 0) where.$or = orConditions;

  // Optional filters
  if (q.startDate) { where.date = where.date || {}; where.date.$gte = new Date(String(q.startDate)); }
  if (q.endDate) { where.date = where.date || {}; where.date.$lte = new Date(String(q.endDate)); }
  if (q.paidTo) where.paidTo = String(q.paidTo);
  if (q.category) where.category = String(q.category);
  if (q.project) where.project = String(q.project);

  const docs = await SubsTxn().find(where).sort({ date: 1, createdAt: 1 }).lean();

  // Build summary and flat data for Excel generator
  let totalExpenses = 0;
  let totalReceipts = 0;
  let runningBalance = 0;
  const data = docs.map((d: any) => {
    const amt = Number(d.amount || 0);
    if (amt < 0) totalExpenses += Math.abs(amt);
    if (amt > 0) totalReceipts += amt;
    runningBalance += amt;
    return {
      date: d.date,
      paidTo: d.paidTo || '',
      category: d.category || 'PAYMENT',
      description: d.description || '',
      amount: amt,
      runningBalance
    };
  });

  const netAmount = totalReceipts - totalExpenses;
  const reportPayload: any = {
    reportType: 'subs-transactions',
    timePeriod: q.timePeriod ? String(q.timePeriod) : undefined,
    subName: resolvedSubName,
    summary: {
      totalExpenses,
      totalReceipts,
      netAmount,
      transactionCount: docs.length
    },
    data
  };

  const buffer = await generateExcelReport(reportPayload);
  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  setHeader(event, 'Content-Disposition', `attachment; filename="subs_report_${Date.now()}.xlsx"`);
  return buffer;
});

