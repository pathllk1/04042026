import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILedgerTransaction extends Document {
  ledgerId: mongoose.Types.ObjectId;
  amount: number;
  balance: number;
  type: 'credit' | 'debit';
  description: string;
  expenseId?: string;
  date: Date;
  firmId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ledgerTransactionSchema = new Schema<ILedgerTransaction>({
  ledgerId: {
    type: Schema.Types.ObjectId,
    ref: 'Ledger',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  balance: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  expenseId: {
    type: String
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  firmId: {
    type: Schema.Types.ObjectId,
    ref: 'Firm',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

export default (mongoose.models.LedgerTransaction as Model<ILedgerTransaction>) || mongoose.model<ILedgerTransaction>('LedgerTransaction', ledgerTransactionSchema);
