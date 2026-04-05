import mongoose from 'mongoose';

const SubsModelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    balance: { type: Number, default: 0 },
    contactInfo: {
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    transactions: { type: Array, default: [] }, // optional cache; primary txns in subsTransactions
    firmId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const SubsModel = () =>
  mongoose.models.SubsMongo || mongoose.model('SubsMongo', SubsModelSchema, 'subsModels');

const SubsTxnSchema = new mongoose.Schema(
  {
    subsModelId: { type: String, required: true },
    date: { type: Date, required: true },
    paidTo: { type: String, default: '' },
    description: { type: String, default: '' },
    amount: { type: Number, required: true }, // positive receipt to subs, negative payment
    category: { type: String, enum: ['PAYMENT', 'RECEIPT'], default: 'PAYMENT' },
    type: { type: String, enum: ['payment', 'receipt'], default: 'payment' },
    project: { type: String, default: '' },
    firmId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const SubsTxnModel = () =>
  mongoose.models.SubsTxnMongo || mongoose.model('SubsTxnMongo', SubsTxnSchema, 'subsTransactions');

export default SubsModel;


