// server/models/AIHistory.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAIHistory extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'letter' | 'code' | 'ask' | 'chat';
  question: string;
  answer: string;
  metadata?: Record<string, any>; // For storing additional data like language, tone, etc.
  parentId?: mongoose.Types.ObjectId; // Reference to parent entry for replies
  isReply?: boolean; // Flag to identify if this is a reply
  createdAt: Date;
  updatedAt: Date;
}

const AIHistorySchema: Schema<IAIHistory> = new Schema<IAIHistory>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['letter', 'code', 'ask', 'chat'], required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  metadata: { type: Object },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AIHistory' },
  isReply: { type: Boolean, default: false },
},
{
  timestamps: true,
});

// Avoid model recompilation during hot-reloads
export default (mongoose.models.AIHistory as Model<IAIHistory>) || mongoose.model<IAIHistory>('AIHistory', AIHistorySchema);