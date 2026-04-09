import mongoose from 'mongoose';
import { defineEventHandler, getRouterParam, createError } from 'h3';
import Ledger from '../../../../models/expenses/Ledger.model';
import LedgerTxn from '../../../../models/expenses/LedgerTxn.model';

export default defineEventHandler(async (event) => {
  const userId = (event as any).context.userId;
  const firmId = (event as any).context.user?.firmId;
  if (!userId || !firmId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Ledger ID is required' });

  const session = await mongoose.startSession();
  try {
    let result: any = {};
    await session.withTransaction(async () => {
      const ledgerDoc: any = await Ledger().findOne({ _id: id, firmId: String(firmId) }).session(session).lean();
      if (!ledgerDoc) throw createError({ statusCode: 404, statusMessage: 'Ledger not found' });

      // Fetch all transactions for this ledger ordered by date ascending
      const txns: any[] = await LedgerTxn()
        .find({ ledgerId: String(id), firmId: String(firmId) })
        .sort({ date: 1, createdAt: 1 })
        .session(session)
        .lean();

      let calculatedBalance = Number(ledgerDoc.openingBalance || 0);
      const updates: { _id: any; balance: number }[] = [];

      for (const txn of txns) {
        if (txn.type === 'credit') calculatedBalance += Number(txn.amount || 0);
        else if (txn.type === 'debit') calculatedBalance -= Number(txn.amount || 0);
        if (Number(txn.balance || 0) !== calculatedBalance) {
          updates.push({ _id: txn._id, balance: calculatedBalance });
        }
      }

      const currentBalance = Number(ledgerDoc.currentBalance || 0);
      const needLedgerUpdate = calculatedBalance !== currentBalance;

      // Apply updates
      for (const u of updates) {
        await LedgerTxn().updateOne({ _id: u._id }, { $set: { balance: u.balance, updatedAt: new Date() } }).session(session);
      }
      if (needLedgerUpdate) {
        await Ledger().updateOne({ _id: id }, { $set: { currentBalance: calculatedBalance, updatedAt: new Date() } }).session(session);
      }

      result = {
        success: true,
        message: needLedgerUpdate || updates.length > 0
          ? 'Ledger balance and transaction balances recalculated successfully'
          : 'Ledger balance and transaction balances are already correct',
        previousBalance: currentBalance,
        newBalance: calculatedBalance,
        difference: calculatedBalance - currentBalance,
        transactionsCount: txns.length,
        transactionsUpdated: updates.length,
        adjustmentsRemoved: 0
      };
    });
    return result;
  } catch (error: any) {
    throw createError({ statusCode: error.statusCode || 500, statusMessage: error.message || 'Recalculation failed' });
  } finally {
    session.endSession();
  }
});

