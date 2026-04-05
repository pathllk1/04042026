import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAdvanceRecovery extends Document {
  employeeAdvanceId: mongoose.Types.ObjectId;
  amount: number;
  date: Date;
  wageId: mongoose.Types.ObjectId;
  firmId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const advanceRecoverySchema = new Schema<IAdvanceRecovery>({
  employeeAdvanceId: {
    type: Schema.Types.ObjectId,
    ref: 'EmployeeAdvance',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  wageId: {
    type: Schema.Types.ObjectId,
    ref: 'Wage',
    required: true
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

export default (mongoose.models.AdvanceRecovery as Model<IAdvanceRecovery>) || mongoose.model<IAdvanceRecovery>('AdvanceRecovery', advanceRecoverySchema);
