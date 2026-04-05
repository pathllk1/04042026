import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEmployeeAdvance extends Document {
  masterRollId: mongoose.Types.ObjectId;
  employeeName: string;
  amount: number;
  date: Date;
  purpose: string;
  repaymentTerms: {
    installmentAmount: number;
    durationMonths: number;
  };
  status: 'pending' | 'approved' | 'paid' | 'partially_recovered' | 'fully_recovered';
  remainingBalance: number;
  firmId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const employeeAdvanceSchema = new Schema<IEmployeeAdvance>({
  masterRollId: {
    type: Schema.Types.ObjectId,
    ref: 'MasterRoll',
    required: true
  },
  employeeName: {
    type: String,
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
  purpose: {
    type: String,
    required: true
  },
  repaymentTerms: {
    installmentAmount: {
      type: Number,
      required: true
    },
    durationMonths: {
      type: Number,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'partially_recovered', 'fully_recovered'],
    default: 'pending',
    required: true
  },
  remainingBalance: {
    type: Number,
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

// Avoid model recompilation during hot-reloads
export default (mongoose.models.EmployeeAdvance as Model<IEmployeeAdvance>) || mongoose.model<IEmployeeAdvance>('EmployeeAdvance', employeeAdvanceSchema);
