import mongoose from 'mongoose';

const ExpensePartySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, default: '' },
    gstin: { type: String, default: '' },
    state: { type: String, default: '' },
    pin: { type: String, default: '' },
    pan: { type: String, default: '' },
    contact: { type: String, default: '' },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      branch: { type: String, default: '' },
      accountHolderName: { type: String, default: '' },
    },
    firmId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const ExpensePartyModel = () =>
  mongoose.models.ExpensePartyMongo ||
  mongoose.model('ExpensePartyMongo', ExpensePartySchema, 'expenseParties');

export default ExpensePartyModel;


