import mongoose, { Schema, Document, Model } from 'mongoose';

// Define the interface for other charges
interface IOtherCharge {
  description?: string;
  oth_amt?: number;
  oth_grate?: number;
  oth_cgst?: number;
  oth_sgst?: number;
  oth_igst?: number;
  oth_hsn?: string;
  oth_tot?: number;
}

// Interface for GST selection tracking
export interface IGSTSelection {
  firmGST: {
    gstNumber: string;
    state: string;
    stateCode: number;
    locationName: string;
    address?: string;
    city?: string;
    pincode?: string;
    isActive?: boolean;
    isDefault?: boolean;
    registrationType?: string;
  };
  partyGST?: {
    gstNumber: string;
    state: string;
    stateCode: number;
    locationName: string;
    address?: string;
    city?: string;
    pincode?: string;
    isActive?: boolean;
    isDefault?: boolean;
    registrationType?: string;
  };
  transactionType: 'intra-state' | 'inter-state';
  gstApplicability: 'cgst-sgst' | 'igst' | 'exempt';
  selectionMethod: 'automatic' | 'manual' | 'default';
  selectionDate: Date;
  selectedBy: mongoose.Types.ObjectId;
}

// Define the interface for the Bills document
export interface IBills extends Document {
  bno: string;
  bdate: Date;
  supply: string;
  addr?: string; // optional
  gstin: string;
  state?: string; // optional
  pin?: number; // optional
  gtot: number;
  disc?: number; // optional
  cgst?: number; // optional
  usern: string;
  sgst?: number; // optional
  firm: string;
  igst?: number; // optional
  rof?: number; // optional
  ntot: number;
  btype: string;
  orderNo?: string; // optional - order number
  orderDate?: Date; // optional - order date
  dispatchThrough?: string; // optional - dispatch method
  docketNo?: string; // optional - docket number
  vehicleNo?: string; // optional - vehicle registration number
  consigneeName?: string; // optional - consignee name
  consigneeGstin?: string; // optional - consignee GSTIN
  consigneeAddress?: string; // optional - consignee address
  consigneeState?: string; // optional - consignee state
  consigneePin?: string; // optional - consignee PIN code
  reasonForNote?: string; // optional - reason for credit/debit note
  originalBillNo?: string; // optional - original bill number
  originalBillDate?: Date; // optional - original bill date
  narration?: string; // optional - invoice narration/additional notes
  status?: string; // optional - bill status (ACTIVE, CANCELLED)
  cancellationReason?: string; // optional - reason for cancellation
  cancelledAt?: Date; // optional - when the bill was cancelled
  cancelledBy?: mongoose.Types.ObjectId; // optional - user who cancelled the bill
  oth_chg?: IOtherCharge[]; // optional array field
  stockRegIds?: mongoose.Types.ObjectId[]; // reference to StockReg
  partyId?: mongoose.Types.ObjectId; // reference to Party
  attachmentUrl?: string; // optional - Google Drive file URL for supporting documents
  attachmentFileId?: string; // optional - Google Drive file ID for supporting documents

  // GST selection tracking
  gstSelection?: IGSTSelection;
}

// Define the schema for other charges
const OtherChargeSchema = new Schema<IOtherCharge>({
  description: { type: String },
  oth_amt: { type: Number },
  oth_grate: { type: Number },
  oth_cgst: { type: Number },
  oth_sgst: { type: Number },
  oth_igst: { type: Number },
  oth_hsn: { type: String },
  oth_tot: { type: Number }
}, { _id: false });

// Schema for GST selection tracking
const GSTSelectionSchema = new Schema<IGSTSelection>({
  firmGST: {
    gstNumber: { type: String, required: true },
    state: { type: String, required: true },
    stateCode: { type: Number, required: true },
    locationName: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    pincode: { type: String },
    isActive: { type: Boolean },
    isDefault: { type: Boolean },
    registrationType: { type: String }
  },
  partyGST: {
    gstNumber: { type: String },
    state: { type: String },
    stateCode: { type: Number },
    locationName: { type: String },
    address: { type: String },
    city: { type: String },
    pincode: { type: String },
    isActive: { type: Boolean },
    isDefault: { type: Boolean },
    registrationType: { type: String }
  },
  transactionType: {
    type: String,
    enum: ['intra-state', 'inter-state'],
    required: true
  },
  gstApplicability: {
    type: String,
    enum: ['cgst-sgst', 'igst', 'exempt'],
    required: true
  },
  selectionMethod: {
    type: String,
    enum: ['automatic', 'manual', 'default'],
    required: true
  },
  selectionDate: { type: Date, required: true },
  selectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: false });

// Define the Bills schema
const BillsSchema: Schema<IBills> = new Schema<IBills>({
  bno: { type: String, required: true },
  bdate: { type: Date, required: true },
  supply: { type: String, required: true },
  addr: { type: String },
  gstin: { type: String, default: 'UNREGISTERED' },
  state: { type: String },
  pin: { type: Number },
  gtot: { type: Number, required: true },
  disc: { type: Number },
  cgst: { type: Number },
  usern: { type: String, required: true },
  sgst: { type: Number },
  firm: { type: String, required: true },
  igst: { type: Number },
  rof: { type: Number },
  ntot: { type: Number, required: true },
  btype: { type: String, default: 'SALES', required: true },
  orderNo: { type: String },
  orderDate: { type: Date },
  dispatchThrough: { type: String },
  docketNo: { type: String },
  vehicleNo: { type: String },
  consigneeName: { type: String },
  consigneeGstin: { type: String },
  consigneeAddress: { type: String },
  consigneeState: { type: String },
  consigneePin: { type: String },
  reasonForNote: { type: String },
  originalBillNo: { type: String },
  originalBillDate: { type: Date },
  narration: { type: String },
  status: { type: String, default: 'ACTIVE', enum: ['ACTIVE', 'CANCELLED'] },
  cancellationReason: { type: String },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  oth_chg: [OtherChargeSchema],
  stockRegIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockReg' }],
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
  attachmentUrl: { type: String },
  attachmentFileId: { type: String },

  // GST selection tracking
  gstSelection: { type: GSTSelectionSchema }
}, {
  timestamps: true
});

// Avoid model recompilation during hot-reloads
export default (mongoose.models.Bills as Model<IBills>) || mongoose.model<IBills>('Bills', BillsSchema);