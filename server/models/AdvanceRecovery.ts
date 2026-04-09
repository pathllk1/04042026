import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAdvanceRecovery extends Document {
  advanceId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  employeeName: string;
  recoveryAmount: number;
  recoveryDate: Date;
  recoveryMethod: string;
  status: 'pending' | 'completed' | 'reversed';
  reason: string;
  previousBalance: number;
  newBalance: number;
  wageId: mongoose.Types.ObjectId;
  firmId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const advanceRecoverySchema = new Schema<IAdvanceRecovery>({
  advanceId: {
    type: Schema.Types.ObjectId,
    ref: 'EmployeeAdvance',
    required: true,
    index: true
  },
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'MasterRoll',
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
  },
  recoveryAmount: {
    type: Number,
    required: true,
    min: 0
  },
  recoveryDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  recoveryMethod: {
    type: String,
    enum: ['salary_deduction', 'cash_payment', 'cheque_payment', 'bank_transfer'],
    default: 'salary_deduction'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'reversed'],
    default: 'pending'
  },
  reason: {
    type: String,
    required: true
  },
  previousBalance: {
    type: Number,
    required: true,
    min: 0
  },
  newBalance: {
    type: Number,
    required: true,
    min: 0
  },
  wageId: {
    type: Schema.Types.ObjectId,
    ref: 'Wage',
    required: true,
    index: true
  },
  firmId: {
    type: Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

export default (mongoose.models.AdvanceRecovery as Model<IAdvanceRecovery>) || mongoose.model<IAdvanceRecovery>('AdvanceRecovery', advanceRecoverySchema);
