// server/models/Role.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IRole extends Document {
  id: string; // UUID
  name: string; // 'user', 'manager', 'admin'
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema: Schema<IRole> = new Schema<IRole>(
  {
    id: { type: String, required: true, unique: true, default: () => uuidv4() },
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// Avoid model recompilation during hot-reloads
export default (mongoose.models.Role as Model<IRole>) || mongoose.model<IRole>('Role', RoleSchema);
