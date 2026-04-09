import mongoose from 'mongoose';
import { defineEventHandler, readBody, createError } from 'h3';
import ExpenseModel from '../../../models/expenses/Expense.model';
import LedgerModel from '../../../models/expenses/Ledger.model';
import LedgerTxnModel from '../../../models/expenses/LedgerTxn.model';

const ExpenseSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    paidTo: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, enum: ['PAYMENT', 'RECEIPT', 'TRANSFER'], default: 'PAYMENT' },
    project: { type: String, default: null },
    paymentMode: {
      type: {
        type: String,
        enum: ['cash', 'bank'],
        required: true
      },
      instrumentNo: { type: String, default: null },
      bankId: { type: String, default: null }
    },
    description: { type: String, default: null },
    paidToGroup: { type: String, default: null },
    hasDeductions: { type: Boolean, default: false },
    deductions: [
      {
        id: String,
        name: String,
        amount: Number,
        description: String
      }
    ],
    netAmount: { type: Number, default: 0 },
    firmId: { type: String, required: true },
    userId: { type: String, required: true },
    isTransfer: { type: Boolean, default: false },
    transferDetails: {
      fromMode: String,
      fromBankId: String,
      toMode: String,
      toBankId: String
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

const ExpenseModelInline = () =>
  mongoose.models.ExpenseMongo || mongoose.model('ExpenseMongo', ExpenseSchema, 'expenses');

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;

  if (!userId || !firmId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readBody(event);
  if (!body?.date || !body?.paidTo || body.amount === undefined || !body?.paymentMode?.type) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
  }

  if (body.paymentMode.type === 'bank' && !body.paymentMode.instrumentNo) {
    throw createError({ statusCode: 400, statusMessage: 'Instrument number is required for bank payments' });
  }

  const hasDeductions = Boolean(body.hasDeductions && Array.isArray(body.deductions) && body.deductions.length > 0);
  const deductions = hasDeductions
    ? body.deductions.map((d: any) => ({
        id: d.id || `deduction_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: d.name || '',
        amount: Math.abs(Number(d.amount) || 0),
        description: d.description || ''
      }))
    : [];

  const totalDeductions = deductions.reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
  const grossAmount = Number(body.amount);
  let netAmount = grossAmount;
  const category = body.category || 'PAYMENT';
  if (hasDeductions) {
    if (category === 'RECEIPT' || grossAmount > 0) netAmount = Math.abs(grossAmount) - totalDeductions;
    else netAmount = -(Math.abs(grossAmount) - totalDeductions);
  }

  // Use a MongoDB transaction to ensure expense + ledger updates are atomic
  const session = await mongoose.startSession();
  try {
    let created: any;
    await session.withTransaction(async () => {
      const Expense = ExpenseModel();
      const Ledger = LedgerModel();
      const LedgerTxn = LedgerTxnModel();

      // 1) Create expense
      created = await Expense.create([
        {
          date: new Date(body.date),
          paidTo: body.paidTo,
          amount: grossAmount,
          category,
          project: body.project || null,
          paymentMode: {
            type: body.paymentMode.type,
            instrumentNo: body.paymentMode.instrumentNo || null,
            bankId: body.paymentMode.bankId || null,
          },
          description: body.description || null,
          paidToGroup: body.paidToGroup || null,
          hasDeductions,
          deductions,
          netAmount,
          firmId: String(firmId),
          userId: String(userId),
          isTransfer: Boolean(body.isTransfer),
          transferDetails: body.transferDetails || null,
        },
      ], { session });
      const expenseDoc: any = Array.isArray(created) ? created[0] : created;

      // 2) Resolve helper to get or create a ledger
      const getOrCreateLedger = async (mode: 'cash' | 'bank', bankId?: string) => {
        const where: any = { firmId: String(firmId) };
        if (mode === 'cash') where.type = 'cash';
        else if (mode === 'bank') where._id = bankId;
        else throw createError({ statusCode: 400, statusMessage: 'Unsupported payment mode' });

        let ledger = await Ledger.findOne(where).session(session);
        if (!ledger && mode === 'cash') {
          // Auto-create default cash ledger if missing
          ledger = await Ledger.create([
            {
              name: 'Cash Book',
              type: 'cash',
              openingBalance: 0,
              currentBalance: 0,
              description: 'Default cash book for all cash transactions',
              firmId: String(firmId),
              userId: String(userId),
            },
          ], { session }).then((docs) => docs[0]);
        }
        if (!ledger) throw createError({ statusCode: 400, statusMessage: 'Ledger not found' });
        return ledger;
      };

      // 3) Post to ledger(s)
      const amountToPost = Number(netAmount);

      if (expenseDoc.isTransfer && expenseDoc.transferDetails) {
        // Transfer: move funds between two ledgers
        const fromMode = expenseDoc.transferDetails.fromMode as 'cash' | 'bank';
        const toMode = expenseDoc.transferDetails.toMode as 'cash' | 'bank';
        const fromBankId = expenseDoc.transferDetails.fromBankId;
        const toBankId = expenseDoc.transferDetails.toBankId;
        const absAmt = Math.abs(Number(netAmount));
        if (!fromMode || !toMode) throw createError({ statusCode: 400, statusMessage: 'Invalid transfer details' });

        const fromLedger = await getOrCreateLedger(fromMode, fromBankId);
        const toLedger = await getOrCreateLedger(toMode, toBankId);

        // Debit source
        const newFromBalance = Number(fromLedger.currentBalance || 0) - absAmt;
        await Ledger.updateOne({ _id: fromLedger._id }, { $set: { currentBalance: newFromBalance, updatedAt: new Date() } }).session(session);
        await LedgerTxn.create([
          {
            ledgerId: String(fromLedger._id),
            expenseId: String(expenseDoc._id),
            date: new Date(expenseDoc.date),
            description: expenseDoc.description || `Transfer to ${toMode === 'bank' ? 'Bank' : 'Cash'}`,
            amount: absAmt,
            type: 'debit',
            balance: newFromBalance,
            firmId: String(firmId),
            userId: String(userId),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ], { session });

        // Credit destination
        const newToBalance = Number(toLedger.currentBalance || 0) + absAmt;
        await Ledger.updateOne({ _id: toLedger._id }, { $set: { currentBalance: newToBalance, updatedAt: new Date() } }).session(session);
        await LedgerTxn.create([
          {
            ledgerId: String(toLedger._id),
            expenseId: String(expenseDoc._id),
            date: new Date(expenseDoc.date),
            description: expenseDoc.description || `Transfer from ${fromMode === 'bank' ? 'Bank' : 'Cash'}`,
            amount: absAmt,
            type: 'credit',
            balance: newToBalance,
            firmId: String(firmId),
            userId: String(userId),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ], { session });
      } else {
        // Regular expense/receipt: single ledger impact using netAmount sign
        const mode = expenseDoc.paymentMode?.type as 'cash' | 'bank';
        const bankId = expenseDoc.paymentMode?.bankId as string | undefined;
        const ledger = await getOrCreateLedger(mode, bankId);

        const newBalance = Number(ledger.currentBalance || 0) + amountToPost;
        await Ledger.updateOne({ _id: ledger._id }, { $set: { currentBalance: newBalance, updatedAt: new Date() } }).session(session);

        const isReceipt = amountToPost > 0;
        await LedgerTxn.create([
          {
            ledgerId: String(ledger._id),
            expenseId: String(expenseDoc._id),
            date: new Date(expenseDoc.date),
            description:
              expenseDoc.description ||
              (isReceipt ? `Receipt from ${expenseDoc.paidTo}` : `Payment to ${expenseDoc.paidTo}`),
            amount: Math.abs(amountToPost),
            type: isReceipt ? 'credit' : 'debit',
            balance: newBalance,
            firmId: String(firmId),
            userId: String(userId),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ], { session });
      }
    });

    const doc: any = Array.isArray(created) ? created[0] : created;
    return {
      id: String(doc._id),
      ...doc.toObject(),
      date: doc.date?.toISOString() || null,
      createdAt: doc.createdAt?.toISOString() || null,
      updatedAt: doc.updatedAt?.toISOString() || null,
    };
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Failed to create expense' });
  } finally {
    session.endSession();
  }
});




