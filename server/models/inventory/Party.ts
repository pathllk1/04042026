import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for additional GST registrations
export interface IPartyGST {
  gstNumber: string;
  state: string;
  stateCode: number;
  locationName: string;
  address: string;
  city: string;
  pincode: string;
  contactPerson?: string;
  contactNumber?: string;
  isActive: boolean;
  isDefault: boolean;
  registrationType: 'regular' | 'composition' | 'unregistered';
  validFrom: Date;
  validTo?: Date;
  lastUsedDate?: Date;
  transactionCount: number;
}

export interface IParty extends Document {
  supply: string;
  addr?: string; // optional
  gstin: string;
  state?: string; // optional
  state_code?: number; // optional - added state code field
  pin?: number; // optional
  pan?: string; // optional
  contact?: string; // optional
  usern: string;
  firm: string;
  billIds?: mongoose.Types.ObjectId[]; // reference to Bills

  // Multi-GST support
  additionalGSTs: IPartyGST[];
  hasMultipleGSTs: boolean;
}

// Schema for additional GST registrations
const PartyGSTSchema = new Schema<IPartyGST>({
  gstNumber: { type: String, required: true },
  state: { type: String, required: true },
  stateCode: { type: Number, required: true, min: 1, max: 38 },
  locationName: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  pincode: { type: String, required: true },
  contactPerson: { type: String },
  contactNumber: { type: String },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  registrationType: {
    type: String,
    enum: ['regular', 'composition', 'unregistered'],
    default: 'regular'
  },
  validFrom: { type: Date, required: true },
  validTo: { type: Date },
  lastUsedDate: { type: Date },
  transactionCount: { type: Number, default: 0 }
}, { _id: false });

const PartySchema: Schema<IParty> = new Schema<IParty>({
  supply: { type: String, required: true },
  addr: { type: String },
  gstin: { type: String, default: 'UNREGISTERED' },
  state: { type: String },
  state_code: { type: Number }, // Added state code field
  pin: { type: Number },
  pan: { type: String },
  contact: { type: String },
  usern: { type: String, required: true },
  firm: { type: String, required: true },
  billIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bills' }],

  // Multi-GST fields
  additionalGSTs: { type: [PartyGSTSchema], default: [] },
  hasMultipleGSTs: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Avoid model recompilation during hot-reloads
export default (mongoose.models.Party as Model<IParty>) || mongoose.model<IParty>('Party', PartySchema);