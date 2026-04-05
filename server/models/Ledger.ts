import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILedger extends Document {
  name: string;
  firmId: mongoose.Types.ObjectId;
  currentBalance: number;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ledgerSchema = new Schema<ILedger>({
  name: {
    type: String,
    required: true
  },
  firmId: {
    type: Schema.Types.ObjectId,
    ref: 'Firm',
    required: true
  },
  currentBalance: {
    type: Number,
    required: true,
    default: 0
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

export default (mongoose.models.Ledger as Model<ILedger>) || mongoose.model<ILedger>('Ledger', ledgerSchema);
