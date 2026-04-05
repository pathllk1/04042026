import mongoose from 'mongoose';

const LedgerTxnSchema = new mongoose.Schema(
  {
    ledgerId: { type: String, required: true },
    expenseId: { type: String, default: null },
    paymentId: { type: String, default: null },
    billId: { type: String, default: null },
    date: { type: Date, required: true },
    description: { type: String, default: '' },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    balance: { type: Number, required: true },
    firmId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const LedgerTxnModel = () =>
  mongoose.models.LedgerTxnMongo || mongoose.model('LedgerTxnMongo', LedgerTxnSchema, 'ledgerTransactions');

export default LedgerTxnModel;


