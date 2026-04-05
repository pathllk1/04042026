import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStocks extends Document {
  item: string;
  pno?: string; // optional, unique
  batch?: string; // optional, unique
  oem?: string; // optional
  hsn: string;
  qty: number;
  uom: string;
  rate: number;
  grate: number;
  total: number;
  mrp?: number; // optional - List Price/MRP
  expiryDate?: Date; // optional - Expiry Date
  user: string;
  firm: string;
}

const StocksSchema: Schema<IStocks> = new Schema<IStocks>({
  item: { type: String, required: true },
  pno: { type: String }, // optional but unique if provided
  batch: { type: String }, // optional but unique if provided
  oem: { type: String }, // optional
  hsn: { type: String, required: true },
  qty: { type: Number, required: true },
  uom: { type: String, required: true },
  rate: { type: Number, required: true },
  grate: { type: Number, required: true },
  total: { type: Number, required: true },
  mrp: { type: Number }, // optional - List Price/MRP
  expiryDate: { type: Date }, // optional - Expiry Date
  user: { type: String, required: true },
  firm: { type: String, required: true }
}, {
  timestamps: true
});

// Avoid model recompilation during hot-reloads
export default (mongoose.models.Stocks as Model<IStocks>) || mongoose.model<IStocks>('Stocks', StocksSchema);