import mongoose, { Schema, Document } from 'mongoose';

export interface ChatMessage extends Document {
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

const ChatMessageSchema = new Schema<ChatMessage>({
  senderId: {
    type: String,
    required: true,
    index: true
  },
  receiverId: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  read: {
    type: Boolean,
    default: false
  }
});

// Create compound index for faster conversation queries
ChatMessageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });
ChatMessageSchema.index({ receiverId: 1, senderId: 1, timestamp: -1 });

// This is a fallback for when Redis is not available
// In production, we'll use Redis for real-time chat
export const ChatMessage = mongoose.models.ChatMessage || mongoose.model<ChatMessage>('ChatMessage', ChatMessageSchema);
