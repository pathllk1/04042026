import mongoose from 'mongoose';
import LedgerModel from '../models/expenses/Ledger.model';
import LedgerTxnModel from '../models/expenses/LedgerTxn.model';

type BillLike = {
  _id: any;
  bno: string;
  bdate: Date | string;
  btype: 'PURCHASE' | 'SALES' | 'DEBIT NOTE' | 'CREDIT NOTE';
  supply: string; // party name
  ntot: number | string;
};

function asNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function resolveOrCreatePartyLedger(
  session: mongoose.ClientSession,
  firmId: string,
  userId: string,
  partyName: string,
) {
  const Ledger = LedgerModel();
  const where: any = { firmId: String(firmId), type: 'party', name: partyName };
  let ledger = await Ledger.findOne(where).session(session);
  if (!ledger) {
    ledger = await Ledger.create([
      {
        name: partyName,
        type: 'party',
        openingBalance: 0,
        currentBalance: 0,
        firmId: String(firmId),
        userId: String(userId),
        isActive: true,
      },
    ], { session }).then(d => d[0]);
  }
  return ledger;
}

async function findExistingTxnByBill(
  session: mongoose.ClientSession,
  firmId: string,
  billId: string,
) {
  const LedgerTxn = LedgerTxnModel();
  return await LedgerTxn.findOne({ firmId: String(firmId), billId: String(billId) })
    .sort({ createdAt: 1 })
    .session(session)
    .lean();
}

async function writeLedgerTxn(
  session: mongoose.ClientSession,
  params: {
    ledgerId: string;
    billId: string;
    firmId: string;
    userId: string;
    date: Date;
    description: string;
    amountAbs: number;
    type: 'credit' | 'debit';
    newBalance: number;
    existingTxnId?: string;
  }
) {
  const LedgerTxn = LedgerTxnModel();
  const now = new Date();
  if (params.existingTxnId) {
    await LedgerTxn.updateOne(
      { _id: params.existingTxnId },
      {
        $set: {
          ledgerId: params.ledgerId,
          billId: params.billId,
          date: params.date,
          description: params.description,
          amount: params.amountAbs,
          type: params.type,
          balance: params.newBalance,
          firmId: params.firmId,
          userId: params.userId,
          updatedAt: now,
        },
      },
    ).session(session);
    return params.existingTxnId;
  }
  const doc = await LedgerTxn.create([
    {
      ledgerId: params.ledgerId,
      billId: params.billId,
      date: params.date,
      description: params.description,
      amount: params.amountAbs,
      type: params.type,
      balance: params.newBalance,
      firmId: params.firmId,
      userId: params.userId,
      createdAt: now,
      updatedAt: now,
    },
  ], { session }).then(d => d[0]);
  return String(doc._id);
}

async function applyPartyLedgerImpact(
  session: mongoose.ClientSession,
  bill: BillLike,
  userId: string,
  firmId: string,
  effect: 'increase' | 'decrease',
) {
  const billId = String(bill._id);
  const amount = asNumber((bill as any).ntot);
  const date = bill.bdate ? new Date(bill.bdate as any) : new Date();
  const description = `${bill.btype} #${bill.bno}`;
  const isIncrease = effect === 'increase';

  const ledger = await resolveOrCreatePartyLedger(session, firmId, userId, bill.supply);
  const currentBalance = asNumber(ledger.currentBalance || 0);

  const existingTxn = await findExistingTxnByBill(session, firmId, billId);

  let newBalance: number;
  if (existingTxn) {
    // Adjust by difference if updating same ledger
    const oldAmount = asNumber(existingTxn.amount || 0);
    const delta = amount - oldAmount;
    newBalance = isIncrease ? currentBalance + delta : currentBalance - delta;
  } else {
    newBalance = isIncrease ? currentBalance + amount : currentBalance - amount;
  }

  // Update ledger balance
  const Ledger = LedgerModel();
  await Ledger.updateOne(
    { _id: ledger._id },
    { $set: { currentBalance: newBalance, updatedAt: new Date() } },
  ).session(session);

  // Create/update txn
  const type: 'credit' | 'debit' = isIncrease ? 'debit' : 'credit';
  const txnId = await writeLedgerTxn(session, {
    ledgerId: String(ledger._id),
    billId,
    firmId: String(firmId),
    userId: String(userId),
    date,
    description,
    amountAbs: Math.abs(amount),
    type,
    newBalance,
    existingTxnId: existingTxn ? String((existingTxn as any)._id) : undefined,
  });

  return { success: true, ledgerId: String(ledger._id), transactionId: txnId, isUpdate: Boolean(existingTxn) };
}

export async function createSalesBillLedgerTransactionMongo(bill: BillLike, userId: string, firmId: string) {
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      result = await applyPartyLedgerImpact(session, bill, userId, firmId, 'increase');
    });
    return result;
  } finally { session.endSession(); }
}

export async function createPurchaseBillLedgerTransactionMongo(bill: BillLike, userId: string, firmId: string) {
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      result = await applyPartyLedgerImpact(session, bill, userId, firmId, 'decrease');
    });
    return result;
  } finally { session.endSession(); }
}

export async function createCreditNoteLedgerTransactionMongo(bill: BillLike, userId: string, firmId: string) {
  // Credit note decreases what we owe: decrease balance
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      result = await applyPartyLedgerImpact(session, bill, userId, firmId, 'decrease');
    });
    return result;
  } finally { session.endSession(); }
}

export async function createDebitNoteLedgerTransactionMongo(bill: BillLike, userId: string, firmId: string) {
  // Debit note increases what is owed to us: increase balance
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      result = await applyPartyLedgerImpact(session, bill, userId, firmId, 'increase');
    });
    return result;
  } finally { session.endSession(); }
}

export async function createCancellationLedgerTransactionMongo(bill: BillLike, userId: string, firmId: string) {
  // Reverse original effect
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const effect = (bill.btype === 'SALES' || bill.btype === 'DEBIT NOTE') ? 'decrease' : 'increase';
      result = await applyPartyLedgerImpact(session, bill, userId, firmId, effect);
    });
    return result;
  } finally { session.endSession(); }
}

export async function createDeletionLedgerTransactionMongo(bill: BillLike, userId: string, firmId: string) {
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const Ledger = LedgerModel();
      const LedgerTxn = LedgerTxnModel();
      const existingTxn = await findExistingTxnByBill(session, firmId, String(bill._id));
      if (!existingTxn) { result = { success: true, message: 'No ledger txn found for bill' }; return; }
      const ledger = await Ledger.findOne({ _id: existingTxn.ledgerId, firmId: String(firmId) }).session(session);
      if (!ledger) { result = { success: true, message: 'No ledger found; nothing to reverse' }; return; }
      const amount = asNumber(existingTxn.amount || 0);
      const currentBalance = asNumber(ledger.currentBalance || 0);
      const newBalance = existingTxn.type === 'debit' ? currentBalance - amount : currentBalance + amount;
      await Ledger.updateOne({ _id: ledger._id }, { $set: { currentBalance: newBalance, updatedAt: new Date() } }).session(session);
      await LedgerTxn.deleteOne({ _id: (existingTxn as any)._id }).session(session);
      result = { success: true, ledgerId: String(ledger._id), reversedAmount: amount };
    });
    return result;
  } finally { session.endSession(); }
}


