import mongoose from 'mongoose';
import ExpenseModel from '../models/expenses/Expense.model';
import LedgerModel from '../models/expenses/Ledger.model';
import LedgerTxnModel from '../models/expenses/LedgerTxn.model';

type LaborPayment = {
  id: string;
  group_id: string;
  payment_date: string | Date;
  amount: number;
  project?: string;
  payment_method: 'cash' | 'bank';
  payment_type?: string;
  bank_details?: {
    bankId?: string;
    instrumentNo?: string;
  };
  firm_id: string;
  user_id?: string;
};

type LaborGroup = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  aadhar?: string;
  bank_details?: any;
};

function toNumber(n: any): number { 
  const x = Number(n); 
  return Number.isFinite(x) ? x : 0; 
}

async function resolveOrCreateLaborGroupLedger(
  session: mongoose.ClientSession,
  firmId: string,
  userId: string,
  groupName: string,
  groupData?: LaborGroup
) {
  const Ledger = LedgerModel();
  const where: any = { firmId: String(firmId), type: 'labor_group', name: groupName };
  let ledger = await Ledger.findOne(where).session(session);
  
  if (!ledger) {
    ledger = await Ledger.create([{
      name: groupName,
      type: 'labor_group',
      openingBalance: 0,
      currentBalance: 0,
      address: groupData?.address || '',
      phone: groupData?.phone || '',
      aadhar: groupData?.aadhar || '',
      bankDetails: groupData?.bank_details || {},
      firmId: String(firmId),
      userId: String(userId),
      isActive: true,
    }], { session }).then(d => d[0]);
  }
  return ledger;
}

async function findExistingTxnByPayment(
  session: mongoose.ClientSession,
  firmId: string,
  paymentId: string,
) {
  const LedgerTxn = LedgerTxnModel();
  return await LedgerTxn.findOne({ firmId: String(firmId), paymentId: String(paymentId) })
    .sort({ createdAt: 1 })
    .session(session)
    .lean();
}

async function writeLedgerTxn(
  session: mongoose.ClientSession,
  params: {
    ledgerId: string;
    paymentId: string;
    expenseId: string;
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
          paymentId: params.paymentId,
          expenseId: params.expenseId,
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
  
  const doc = await LedgerTxn.create([{
    ledgerId: params.ledgerId,
    paymentId: params.paymentId,
    expenseId: params.expenseId,
    date: params.date,
    description: params.description,
    amount: params.amountAbs,
    type: params.type,
    balance: params.newBalance,
    firmId: params.firmId,
    userId: params.userId,
    createdAt: now,
    updatedAt: now,
  }], { session }).then(d => d[0]);
  
  return String(doc._id);
}

async function resolveOrCreateBankCashLedger(
  session: mongoose.ClientSession,
  firmId: string,
  userId: string,
  paymentMethod: 'cash' | 'bank',
  bankId?: string
) {
  const Ledger = LedgerModel();
  let ledger;
  
  if (paymentMethod === 'cash') {
    // Find or create cash ledger
    ledger = await Ledger.findOne({ firmId: String(firmId), type: 'cash' }).session(session);
    if (!ledger) {
      ledger = await Ledger.create([{
        name: 'Cash Book',
        type: 'cash',
        openingBalance: 0,
        currentBalance: 0,
        description: 'Default cash book for all cash transactions',
        firmId: String(firmId),
        userId: String(userId),
        isActive: true,
      }], { session }).then(d => d[0]);
    }
  } else if (paymentMethod === 'bank' && bankId) {
    // Find bank ledger by ID
    ledger = await Ledger.findOne({ _id: bankId, firmId: String(firmId), type: 'bank' }).session(session);
    if (!ledger) {
      throw new Error(`Bank ledger not found: ${bankId}`);
    }
  } else {
    throw new Error('Invalid payment method or missing bank ID');
  }
  
  return ledger;
}

async function applyLaborGroupLedgerImpact(
  session: mongoose.ClientSession,
  payment: LaborPayment,
  groupData: LaborGroup,
  userId: string,
  firmId: string,
) {
  const paymentId = String(payment.id);
  const amount = toNumber(payment.amount);
  const date = payment.payment_date ? new Date(payment.payment_date) : new Date();
  const description = `Labor payment to ${groupData.name} - ${payment.payment_type || 'Payment'}`;

  // 1. Handle Labor Group Ledger (existing logic)
  const laborLedger = await resolveOrCreateLaborGroupLedger(session, firmId, userId, groupData.name, groupData);
  const laborCurrentBalance = toNumber(laborLedger.currentBalance || 0);

  const existingLaborTxn = await findExistingTxnByPayment(session, firmId, paymentId);

  let laborNewBalance: number;
  if (existingLaborTxn) {
    // Adjust by difference if updating same ledger
    const oldAmount = toNumber(existingLaborTxn.amount || 0);
    const delta = amount - oldAmount;
    laborNewBalance = laborCurrentBalance - delta; // Subtract for payment (we paid money to group)
  } else {
    laborNewBalance = laborCurrentBalance - amount; // Subtract for payment (we paid money to group)
  }

  // Update labor group ledger balance
  const Ledger = LedgerModel();
  await Ledger.updateOne(
    { _id: laborLedger._id },
    { $set: { currentBalance: laborNewBalance, updatedAt: new Date() } },
  ).session(session);

  // 2. Handle Bank/Cash Ledger (NEW - following wages/expenses pattern)
  const bankCashLedger = await resolveOrCreateBankCashLedger(
    session, 
    firmId, 
    userId, 
    payment.payment_method, 
    payment.bank_details?.bankId
  );
  
  const bankCashCurrentBalance = toNumber(bankCashLedger.currentBalance || 0);
  
  // Find existing bank/cash transaction for this payment
  const existingBankCashTxn = await LedgerTxnModel().findOne({ 
    firmId: String(firmId), 
    paymentId: paymentId,
    ledgerId: String(bankCashLedger._id)
  }).session(session);
  
  let bankCashNewBalance: number;
  if (existingBankCashTxn) {
    // Adjust by difference if updating
    const oldAmount = toNumber(existingBankCashTxn.amount || 0);
    const delta = amount - oldAmount;
    bankCashNewBalance = bankCashCurrentBalance - delta; // Subtract for payment out
  } else {
    bankCashNewBalance = bankCashCurrentBalance - amount; // Subtract for payment out
  }

  // Update bank/cash ledger balance
  await Ledger.updateOne(
    { _id: bankCashLedger._id },
    { $set: { currentBalance: bankCashNewBalance, updatedAt: new Date() } },
  ).session(session);

  // 3. Create/update expense entry
  const Expense = ExpenseModel();
  const expenseId = `labor_${paymentId}`;
  
  const existingExpense = await Expense.findOne({ firmId: String(firmId), expenseId }).session(session);
  const expenseData = {
    date,
    paidTo: groupData.name,
    amount: -amount, // Negative for payment out
    category: 'PAYMENT',
    project: payment.project || null,
    paymentMode: {
      type: payment.payment_method,
      instrumentNo: payment.bank_details?.instrumentNo || null,
      bankId: payment.bank_details?.bankId || null,
    },
    description,
    paidToGroup: 'LABOR',
    hasDeductions: false,
    deductions: [],
    netAmount: -amount,
    firmId: String(firmId),
    userId: String(userId),
    isTransfer: false,
    transferDetails: null,
    expenseId, // Link field for idempotency
  };

  if (existingExpense) {
    await Expense.updateOne(
      { _id: existingExpense._id },
      { $set: { ...expenseData, updatedAt: new Date() } }
    ).session(session);
  } else {
    await Expense.create([{ ...expenseData, createdAt: new Date(), updatedAt: new Date() }], { session });
  }

  // 4. Create/update labor group ledger transaction
  const laborTxnId = await writeLedgerTxn(session, {
    ledgerId: String(laborLedger._id),
    paymentId,
    expenseId,
    firmId: String(firmId),
    userId: String(userId),
    date,
    description,
    amountAbs: Math.abs(amount),
    type: 'credit', // Credit for labor payment (we paid money to the group)
    newBalance: laborNewBalance,
    existingTxnId: existingLaborTxn ? String((existingLaborTxn as any)._id) : undefined,
  });

  // 5. Create/update bank/cash ledger transaction (NEW)
  const bankCashTxnId = await writeLedgerTxn(session, {
    ledgerId: String(bankCashLedger._id),
    paymentId,
    expenseId,
    firmId: String(firmId),
    userId: String(userId),
    date,
    description: `Payment to ${groupData.name} - ${payment.payment_method === 'cash' ? 'Cash' : 'Bank'}`,
    amountAbs: Math.abs(amount),
    type: 'debit', // Debit for bank/cash (money going out)
    newBalance: bankCashNewBalance,
    existingTxnId: existingBankCashTxn ? String((existingBankCashTxn as any)._id) : undefined,
  });

  return { 
    success: true, 
    laborLedgerId: String(laborLedger._id), 
    bankCashLedgerId: String(bankCashLedger._id),
    laborTransactionId: laborTxnId, 
    bankCashTransactionId: bankCashTxnId,
    expenseId,
    isUpdate: Boolean(existingLaborTxn) 
  };
}

export async function createLaborPaymentLedgerTransactionMongo(
  payment: LaborPayment, 
  groupData: LaborGroup, 
  userId: string, 
  firmId: string
) {
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      result = await applyLaborGroupLedgerImpact(session, payment, groupData, userId, firmId);
    });
    return result;
  } finally { 
    session.endSession(); 
  }
}

export async function createLaborPaymentDeletionTransactionMongo(
  payment: LaborPayment, 
  groupData: LaborGroup, 
  userId: string, 
  firmId: string
) {
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const Ledger = LedgerModel();
      const LedgerTxn = LedgerTxnModel();
      const Expense = ExpenseModel();
      
      const firmIdStr = String(firmId);
      const paymentId = String(payment.id);
      const expenseId = `labor_${paymentId}`;

      // Find existing labor group transaction
      const existingLaborTxn = await findExistingTxnByPayment(session, firmId, paymentId);
      if (!existingLaborTxn) { 
        result = { success: true, message: 'No labor ledger transaction found for payment' }; 
        return; 
      }

      // 1. Reverse Labor Group Ledger
      const laborLedger = await Ledger.findOne({ _id: existingLaborTxn.ledgerId, firmId: firmIdStr }).session(session);
      if (!laborLedger) { 
        result = { success: true, message: 'No labor ledger found; nothing to reverse' }; 
        return; 
      }

      const amount = toNumber(existingLaborTxn.amount || 0);
      const laborCurrentBalance = toNumber(laborLedger.currentBalance || 0);
      const laborNewBalance = laborCurrentBalance + amount; // Add back for deletion (reverse payment)

      await Ledger.updateOne(
        { _id: laborLedger._id }, 
        { $set: { currentBalance: laborNewBalance, updatedAt: new Date() } }
      ).session(session);

      // 2. Reverse Bank/Cash Ledger (NEW)
      const bankCashLedger = await resolveOrCreateBankCashLedger(
        session, 
        firmId, 
        userId, 
        payment.payment_method, 
        payment.bank_details?.bankId
      );
      
      // Find existing bank/cash transaction for this payment
      const existingBankCashTxn = await LedgerTxn.findOne({ 
        firmId: firmIdStr, 
        paymentId: paymentId,
        ledgerId: String(bankCashLedger._id)
      }).session(session);
      
      if (existingBankCashTxn) {
        const bankCashCurrentBalance = toNumber(bankCashLedger.currentBalance || 0);
        const bankCashAmount = toNumber(existingBankCashTxn.amount || 0);
        const bankCashNewBalance = bankCashCurrentBalance + bankCashAmount; // Add back for deletion (reverse payment)

        await Ledger.updateOne(
          { _id: bankCashLedger._id }, 
          { $set: { currentBalance: bankCashNewBalance, updatedAt: new Date() } }
        ).session(session);

        // Delete bank/cash transaction
        await LedgerTxn.deleteOne({ _id: (existingBankCashTxn as any)._id }).session(session);
      }

      // Delete labor transaction and expense
      await LedgerTxn.deleteOne({ _id: (existingLaborTxn as any)._id }).session(session);
      await Expense.deleteOne({ firmId: firmIdStr, expenseId }).session(session);

      result = { 
        success: true, 
        laborLedgerId: String(laborLedger._id), 
        bankCashLedgerId: String(bankCashLedger._id),
        reversedAmount: amount,
        message: `Reversed payment of ${amount} for ${groupData.name} from ${payment.payment_method === 'cash' ? 'Cash' : 'Bank'}`
      };
    });
    return result;
  } finally { 
    session.endSession(); 
  }
}

export async function postLaborPaymentsToLedgerMongo(
  payments: Array<{ payment: LaborPayment; group: LaborGroup }>, 
  firmId: string, 
  userId: string
) {
  const results: any[] = [];
  for (const { payment, group } of payments) {
    try {
      const r = await createLaborPaymentLedgerTransactionMongo(payment, group, userId, firmId);
      results.push({ paymentId: payment.id, success: true, ...r });
    } catch (e: any) {
      results.push({ paymentId: payment.id, success: false, error: e?.message || 'Failed' });
    }
  }
  const successCount = results.filter(r => r.success).length;
  return { 
    success: true, 
    successCount, 
    failureCount: results.length - successCount, 
    results 
  };
}
