// server/models/Firm.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for additional GST registrations
export interface IFirmGST {
  gstNumber: string;
  state: string;
  stateCode: number;
  locationName: string;
  address: string;
  city: string;
  pincode: string;
  isActive: boolean;
  isDefault: boolean;
  registrationType: 'regular' | 'composition' | 'casual' | 'sez';
  registrationDate: Date;
  validFrom: Date;
  validTo?: Date;
}

export interface IFirm extends Document {
  name: string;
  code: string;
  description?: string;
  address: string;
  state: string;
  contactPerson: string;
  contactNo: string;
  email: string;
  gstNo: string;
  businessType: string;
  status: 'pending' | 'approved' | 'rejected';

  // Multi-GST support
  additionalGSTs: IFirmGST[];
  hasMultipleGSTs: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// Schema for additional GST registrations
const FirmGSTSchema = new Schema<IFirmGST>({
  gstNumber: { type: String, required: true },
  state: { type: String, required: true },
  stateCode: { type: Number, required: true, min: 1, max: 38 },
  locationName: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  pincode: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  registrationType: {
    type: String,
    enum: ['regular', 'composition', 'casual', 'sez'],
    default: 'regular'
  },
  registrationDate: { type: Date, required: true },
  validFrom: { type: Date, required: true },
  validTo: { type: Date }
}, { _id: false });

const FirmSchema: Schema<IFirm> = new Schema<IFirm>({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  description: { type: String },
  address: { type: String, required: true },
  state: { type: String },
  contactPerson: { type: String, required: true },
  contactNo: { type: String, required: true },
  email: { type: String, required: true },
  gstNo: { type: String, required: true },
  businessType: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },

  // Multi-GST fields
  additionalGSTs: { type: [FirmGSTSchema], default: [] },
  hasMultipleGSTs: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Avoid model recompilation during hot-reloads
export default (mongoose.models.Firm as Model<IFirm>) || mongoose.model<IFirm>('Firm', FirmSchema);