import mongoose from 'mongoose';

const ExpenseSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    paidTo: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, enum: ['PAYMENT', 'RECEIPT', 'TRANSFER'], default: 'PAYMENT' },
    project: { type: String, default: null },
    paymentMode: {
      type: {
        type: String,
        enum: ['cash', 'bank'],
        required: true,
      },
      instrumentNo: { type: String, default: null },
      bankId: { type: String, default: null },
    },
    description: { type: String, default: null },
    paidToGroup: { type: String, default: null },
    hasDeductions: { type: Boolean, default: false },
    deductions: [
      {
        id: String,
        name: String,
        amount: Number,
        description: String,
      },
    ],
    netAmount: { type: Number, default: 0 },
    firmId: { type: String, required: true },
    userId: { type: String, required: true },
    isTransfer: { type: Boolean, default: false },
    transferDetails: {
      fromMode: String,
      fromBankId: String,
      toMode: String,
      toBankId: String,
    },
    expenseId: { type: String, default: null }, // For idempotency with external systems
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const ExpenseModel = () =>
  mongoose.models.ExpenseMongo || mongoose.model('ExpenseMongo', ExpenseSchema, 'expenses');

export default ExpenseModel;


