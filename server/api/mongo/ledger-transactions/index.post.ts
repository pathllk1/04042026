import mongoose from 'mongoose';
import { defineEventHandler, readBody, createError } from 'h3';

// Minimal models inline
const LedgerSchema = new mongoose.Schema({}, { strict: false });
const Ledger = () => mongoose.models.LedgerMongo || mongoose.model('LedgerMongo', LedgerSchema, 'ledgers');

const LedgerTxnSchema = new mongoose.Schema({}, { strict: false });
const LedgerTxn = () => mongoose.models.LedgerTxnMongo || mongoose.model('LedgerTxnMongo', LedgerTxnSchema, 'ledgerTransactions');

const ExpenseSchema = new mongoose.Schema({}, { strict: false });
const Expense = () => mongoose.models.ExpenseMongo || mongoose.model('ExpenseMongo', ExpenseSchema, 'expenses');

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  const body = await readBody(event);
  // body: { expenseId, date, description, amount, paymentMode: { type, bankId }, category, paidTo, hasDeductions/netAmount }
  if (!body?.expenseId || !body?.paymentMode?.type || !body?.date) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
  }

  const firmIdStr = String(firmId);
  const date = new Date(body.date);
  const amount = Number(body.netAmount ?? body.amount);
  const isReceipt = amount > 0;

  // Resolve ledger
  const ledgerWhere: any = { firmId: firmIdStr };
  if (body.paymentMode.type === 'cash') ledgerWhere.type = 'cash';
  else if (body.paymentMode.type === 'bank') ledgerWhere._id = body.paymentMode.bankId;
  else throw createError({ statusCode: 400, statusMessage: 'Unsupported payment mode' });

  const LedgerModel = Ledger();
  const ledgerDoc = await LedgerModel.findOne(ledgerWhere);
  if (!ledgerDoc) throw createError({ statusCode: 400, statusMessage: 'Ledger not found' });

  // Update ledger balance and create ledger transaction
  const newBalance = Number(ledgerDoc.currentBalance || 0) + amount;
  ledgerDoc.currentBalance = newBalance;
  ledgerDoc.updatedAt = new Date();
  await ledgerDoc.save();

  const LedgerTransaction = LedgerTxn();
  const txn = await LedgerTransaction.create({
    ledgerId: String(ledgerDoc._id),
    expenseId: String(body.expenseId),
    date,
    description: body.description || (isReceipt ? `Receipt from ${body.paidTo}` : `Payment to ${body.paidTo}`),
    amount: Math.abs(amount),
    type: isReceipt ? 'credit' : 'debit',
    balance: newBalance,
    firmId: firmIdStr,
    userId: String(userId),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  return { success: true, transactionId: String(txn._id), newBalance };
});



