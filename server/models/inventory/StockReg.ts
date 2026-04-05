import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStockReg extends Document {
  type: string;
  bno: string;
  bdate: Date;
  supply: string;
  item: string;
  item_narration?: string; // optional
  pno?: string; // optional
  batch?: string; // optional
  oem?: string; // optional
  hsn: string;
  qty: number;
  qtyh: number;
  uom: string;
  rate: number;
  grate?: number; // optional
  cgst?: number; // optional
  sgst?: number; // optional
  igst?: number; // optional
  disc?: number; // optional
  discamt?: number; // optional
  total: number;
  mrp?: number; // optional - List Price/MRP
  expiryDate?: Date; // optional - Expiry Date
  project?: string; // optional
  user: string;
  firm: string;
  rid?: string; // optional
  stockId?: mongoose.Types.ObjectId; // reference to Stocks
  billId?: mongoose.Types.ObjectId; // reference to Bills
}

const StockRegSchema: Schema<IStockReg> = new Schema<IStockReg>({
  type: { type: String, required: true },
  bno: { type: String, required: true },
  bdate: { type: Date, required: true },
  supply: { type: String, required: true },
  item: { type: String, required: true },
  item_narration: { type: String },
  pno: { type: String },
  batch: { type: String },
  oem: { type: String },
  hsn: { type: String, required: true },
  qty: { type: Number, required: true },
  qtyh: { type: Number, required: true },
  uom: { type: String, required: true },
  rate: { type: Number, required: true },
  grate: { type: Number },
  cgst: { type: Number },
  sgst: { type: Number },
  igst: { type: Number },
  disc: { type: Number },
  discamt: { type: Number },
  total: { type: Number, required: true },
  mrp: { type: Number }, // optional - List Price/MRP
  expiryDate: { type: Date }, // optional - Expiry Date
  project: { type: String },
  user: { type: String, required: true },
  firm: { type: String, required: true },
  rid: { type: String },
  stockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stocks' },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bills' }
}, {
  timestamps: true
});

// Avoid model recompilation during hot-reloads
export default (mongoose.models.StockReg as Model<IStockReg>) || mongoose.model<IStockReg>('StockReg', StockRegSchema);