import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMasterRoll extends Document {
  employeeName: string;
  fatherHusbandName: string;
  dateOfBirth: Date;
  aadhar: string;
  pan?: string;
  phoneNo: string;
  address: string;
  bank: string;
  branch?: string;
  accountNo: string;
  ifsc: string;
  uan?: string;
  esicNo?: string;
  sKalyanNo?: string;
  category?: string;
  pDayWage?: number;
  project?: string;
  site?: string;
  dateOfJoining: Date;
  dateOfExit?: Date;
  doeRem?: string;
  userId?: mongoose.Types.ObjectId;
  firmId: mongoose.Types.ObjectId;
  status: 'active' | 'inactive' | 'terminated' | 'left';
  createdAt: Date;
  updatedAt: Date;
}

const masterRollSchema = new Schema<IMasterRoll>({
  employeeName: {
    type: String,
    required: true
  },
  fatherHusbandName: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  aadhar: {
    type: String,
    required: true,
    unique: true
  },
  pan: String,
  phoneNo: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  bank: {
    type: String,
    required: true
  },
  branch: {
    type: String,
    required: false
  },
  accountNo: {
    type: String,
    required: true
  },
  ifsc: {
    type: String,
    required: true
  },
  uan: String,
  esicNo: String,
  sKalyanNo: String,
  category: {
    type: String,
    default: 'HELPER'
  },
  pDayWage: Number,
  project: String,
  site: String,
  dateOfJoining: {
    type: Date,
    required: true
  },
  dateOfExit: Date,
  doeRem: String,
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  firmId: {
    type: Schema.Types.ObjectId,
    ref: 'Firm',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'terminated', 'left'],
    default: 'active',
    required: true
  }
}, {
  timestamps: true
});

// Avoid model recompilation during hot-reloads
const MasterRollModel = (mongoose.models.MasterRoll as Model<IMasterRoll>) ||
  mongoose.model<IMasterRoll>('MasterRoll', masterRollSchema);

export { MasterRollModel as MasterRoll };
export default MasterRollModel;