// server/models/ManagerCode.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IManagerCode extends Document {
  code: string;
  used: boolean;
  createdAt: Date;
  usedAt?: Date;
  usedBy?: mongoose.Types.ObjectId;
}

const ManagerCodeSchema: Schema<IManagerCode> = new Schema<IManagerCode>({
  code: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  usedAt: { type: Date },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Avoid model recompilation during hot-reloads
export default (mongoose.models.ManagerCode as Model<IManagerCode>) || mongoose.model<IManagerCode>('ManagerCode', ManagerCodeSchema);