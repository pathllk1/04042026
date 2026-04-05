import mongoose from 'mongoose';
import ExpenseModel from '../models/expenses/Expense.model';
import LedgerModel from '../models/expenses/Ledger.model';
import LedgerTxnModel from '../models/expenses/LedgerTxn.model';

type Wage = {
  _id: any;
  employeeName: string;
  ledgerId: string; // bank ledger
  net_salary: number;
  paid_date: string | Date;
  salary_month: string | Date;
  cheque_no?: string;
  project?: string;
};

function toNumber(n: any) { const x = Number(n); return Number.isFinite(x) ? x : 0; }

export async function postWageToLedgerMongo(wage: Wage, firmId: string, userId: string) {
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const Expense = ExpenseModel();
      const Ledger = LedgerModel();
      const LedgerTxn = LedgerTxnModel();

      const firmIdStr = String(firmId);
      const userIdStr = String(userId);
      const amount = toNumber(wage.net_salary);
      const expenseId = String(wage._id);
      const date = new Date(wage.paid_date);

      // Resolve bank ledger
      const ledger = await Ledger.findOne({ _id: wage.ledgerId, firmId: firmIdStr }).session(session);
      if (!ledger) throw new Error(`Ledger not found: ${wage.ledgerId}`);

      // Update ledger balance (money out)
      const newBalance = toNumber(ledger.currentBalance || 0) - amount;
      await Ledger.updateOne({ _id: ledger._id }, { $set: { currentBalance: newBalance, updatedAt: new Date() } }).session(session);

      // Upsert expense by expenseId
      const existingExpense = await Expense.findOne({ firmId: firmIdStr, userId: userIdStr, expenseId }).session(session);
      if (existingExpense) {
        await Expense.updateOne(
          { _id: existingExpense._id },
          {
            $set: {
              amount: -amount,
              category: 'PAYMENT',
              date,
              description: `Salary payment to ${wage.employeeName} for ${new Date(wage.salary_month).toLocaleDateString()}`,
              paidTo: wage.employeeName,
              paidToGroup: 'SALARY',
              paymentMode: { type: 'bank', bankId: wage.ledgerId, instrumentNo: wage.cheque_no || '' },
              project: wage.project || 'KIR_NON_CORE',
              updatedAt: new Date(),
            },
          }
        ).session(session);
      } else {
        await Expense.create([
          {
            date,
            paidTo: wage.employeeName,
            amount: -amount,
            category: 'PAYMENT',
            project: wage.project || 'KIR_NON_CORE',
            paymentMode: { type: 'bank', bankId: wage.ledgerId, instrumentNo: wage.cheque_no || '' },
            description: `Salary payment to ${wage.employeeName} for ${new Date(wage.salary_month).toLocaleDateString()}`,
            paidToGroup: 'SALARY',
            hasDeductions: false,
            deductions: [],
            netAmount: -amount,
            firmId: firmIdStr,
            userId: userIdStr,
            isTransfer: false,
            transferDetails: null,
            // Link field to identify wage-expense for idempotency
            expenseId,
          },
        ], { session });
      }

      // Upsert ledger transaction linked to expenseId
      const existingTxn = await LedgerTxn.findOne({ firmId: firmIdStr, ledgerId: String(ledger._id), expenseId }).session(session);
      const payload = {
        ledgerId: String(ledger._id),
        expenseId,
        date,
        description: `Salary payment to ${wage.employeeName} for ${new Date(wage.salary_month).toLocaleDateString()}`,
        amount: amount,
        type: 'debit' as const,
        balance: newBalance,
        firmId: firmIdStr,
        userId: userIdStr,
        updatedAt: new Date(),
      };
      if (existingTxn) {
        await LedgerTxn.updateOne({ _id: existingTxn._id }, { $set: payload }).session(session);
        result = { success: true, ledgerId: String(ledger._id), transactionId: String(existingTxn._id), isUpdate: true };
      } else {
        const created = await LedgerTxn.create([{ ...payload, createdAt: new Date() }], { session });
        result = { success: true, ledgerId: String(ledger._id), transactionId: String(created[0]._id), isUpdate: false };
      }
    });
    return result;
  } finally { session.endSession(); }
}

export async function postWagesToLedgerMongo(wages: Wage[], firmId: string, userId: string) {
  const results: any[] = [];
  for (const w of wages) {
    try {
      const r = await postWageToLedgerMongo(w, firmId, userId);
      results.push({ wageId: w._id, success: true, ...r });
    } catch (e: any) {
      results.push({ wageId: w._id, success: false, error: e?.message || 'Failed' });
    }
  }
  const successCount = results.filter(r => r.success).length;
  return { success: true, successCount, failureCount: results.length - successCount, results };
}

export async function deleteWageFromLedgerMongo(wage: Wage, firmId: string, userId: string) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const Expense = ExpenseModel();
      const Ledger = LedgerModel();
      const LedgerTxn = LedgerTxnModel();
      const firmIdStr = String(firmId);
      const expenseId = String(wage._id);

      // Find txn
      const txn = await LedgerTxn.findOne({ firmId: firmIdStr, expenseId }).session(session);
      if (txn) {
        const ledger = await Ledger.findOne({ _id: txn.ledgerId, firmId: firmIdStr }).session(session);
        if (ledger) {
          const current = toNumber(ledger.currentBalance || 0);
          const newBalance = current + toNumber(txn.amount || 0);
          await Ledger.updateOne({ _id: ledger._id }, { $set: { currentBalance: newBalance, updatedAt: new Date() } }).session(session);
        }
        await LedgerTxn.deleteOne({ _id: txn._id }).session(session);
      }
      // Delete expense
      await Expense.deleteOne({ firmId: firmIdStr, expenseId }).session(session);
    });
    return { success: true };
  } finally { session.endSession(); }
}


