import mongoose from 'mongoose';

const LedgerSchema = new mongoose.Schema(
  {
    name: String,
    type: { type: String, enum: ['cash', 'bank', 'party', 'labor_group'] },
    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    bankDetails: {
      bankName: String,
      accountNumber: String,
      ifscCode: String,
      branch: String,
    },
    firmId: { type: String, required: true },
    userId: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const LedgerModel = () =>
  mongoose.models.LedgerMongo || mongoose.model('LedgerMongo', LedgerSchema, 'ledgers');

export default LedgerModel;


