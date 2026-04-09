import mongoose from 'mongoose';
import { defineEventHandler, getQuery, createError } from 'h3';

const ExpenseSchema = new mongoose.Schema({},{ strict: false });
const ExpenseModel = () =>
  mongoose.models.ExpenseMongo || mongoose.model('ExpenseMongo', ExpenseSchema, 'expenses');

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // make Monday=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  try {
    const q = getQuery(event);
    const type = String(q.type || 'monthly');
    const where: any = { firmId: String(firmId) };

    if (q.startDate) {
      where.date = where.date || {};
      where.date.$gte = new Date(String(q.startDate));
    }
    if (q.endDate) {
      where.date = where.date || {};
      where.date.$lte = new Date(String(q.endDate));
    }
    if (q.paidTo) where.paidTo = String(q.paidTo);
    if (q.category) where.category = String(q.category);
    if (q.project) where.project = String(q.project);
    if (q.paidToGroup) where.paidToGroup = String(q.paidToGroup);
    if (q.isTransfer !== undefined) where.isTransfer = String(q.isTransfer) === 'true';
    if (q.paymentMode) where['paymentMode.type'] = String(q.paymentMode);

    const Expense = ExpenseModel();
    const docs = await Expense.find(where).lean();

    // Build summary
    let totalExpenses = 0;
    let totalReceipts = 0;
    for (const d of docs) {
      const amt = Number(d.netAmount ?? d.amount ?? 0);
      if (amt < 0) totalExpenses += Math.abs(amt);
      else totalReceipts += amt;
    }

    const data: any[] = [];
    if (['daily', 'weekly', 'monthly', 'yearly', 'financial-year'].includes(type)) {
      const buckets = new Map<string, { count: number; totalExpenses: number; totalReceipts: number; date?: string; week?: string; month?: string; year?: number; financialYear?: string }>();
      for (const d of docs) {
        const dt = d.date ? new Date(d.date) : null;
        if (!dt) continue;
        let key = '';
        if (type === 'daily') key = dt.toISOString().slice(0, 10);
        else if (type === 'weekly') {
          const start = startOfWeek(dt);
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          key = `${start.toISOString().slice(0,10)}_${end.toISOString().slice(0,10)}`;
        } else if (type === 'monthly') {
          key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
        } else if (type === 'yearly') {
          key = `${dt.getFullYear()}`;
        } else if (type === 'financial-year') {
          const y = dt.getMonth() >= 3 ? dt.getFullYear() : dt.getFullYear() - 1; // FY Apr-Mar
          key = `${y}-${y+1}`;
        }
        if (!buckets.has(key)) buckets.set(key, { count: 0, totalExpenses: 0, totalReceipts: 0 });
        const b = buckets.get(key)!;
        b.count += 1;
        const amt = Number(d.netAmount ?? d.amount ?? 0);
        if (amt < 0) b.totalExpenses += Math.abs(amt);
        else b.totalReceipts += amt;
      }
      for (const [k, v] of buckets.entries()) {
        const item: any = { ...v, netAmount: v.totalReceipts - v.totalExpenses };
        if (type === 'daily') item.date = k;
        else if (type === 'weekly') item.week = k;
        else if (type === 'monthly') item.month = k;
        else if (type === 'yearly') item.year = Number(k);
        else if (type === 'financial-year') item.financialYear = k;
        data.push(item);
      }
      // Keep natural order by key
      data.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    } else if (['paidTo', 'category', 'project', 'subs'].includes(type)) {
      const field = type === 'paidTo' ? 'paidTo' : type === 'category' ? 'category' : 'project';
      const buckets = new Map<string, { count: number; totalExpenses: number; totalReceipts: number }>();
      for (const d of docs) {
        if (type === 'subs' && d.paidToGroup !== 'subs') continue;
        const key = String(d[field] || (field === 'project' ? 'No Project' : field === 'category' ? 'Uncategorized' : ''));
        if (!buckets.has(key)) buckets.set(key, { count: 0, totalExpenses: 0, totalReceipts: 0 });
        const b = buckets.get(key)!;
        b.count += 1;
        const amt = Number(d.netAmount ?? d.amount ?? 0);
        if (amt < 0) b.totalExpenses += Math.abs(amt);
        else b.totalReceipts += amt;
      }
      for (const [k, v] of buckets.entries()) {
        const row: any = { count: v.count, totalExpenses: v.totalExpenses, totalReceipts: v.totalReceipts, netAmount: v.totalReceipts - v.totalExpenses };
        if (type === 'paidTo' || type === 'subs') row.paidTo = k;
        if (type === 'category') row.category = k;
        if (type === 'project') row.project = k;
        data.push(row);
      }
      data.sort((a, b) => (b.totalExpenses + b.totalReceipts) - (a.totalExpenses + a.totalReceipts));
    } else {
      // Fallback: return list
      for (const d of docs) {
        data.push({ id: String(d._id), date: d.date, paidTo: d.paidTo, amount: d.netAmount ?? d.amount, category: d.category, project: d.project, paymentMode: d.paymentMode });
      }
    }

    return {
      summary: {
        totalExpenses,
        totalReceipts,
        netAmount: totalReceipts - totalExpenses
      },
      data
    };
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Failed to generate report' });
  }
});




