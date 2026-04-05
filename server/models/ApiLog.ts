import mongoose, { Schema, Document } from 'mongoose';

export interface IApiLog extends Document {
  timestamp: Date;
  method: string;
  path: string;
  query: any;
  headers: string | null;
  userId: string | null;
  statusCode: number;
  responseTime: number;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApiLogSchema = new Schema({
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  method: { 
    type: String, 
    required: true,
    index: true
  },
  path: { 
    type: String, 
    required: true,
    index: true
  },
  query: { 
    type: Schema.Types.Mixed 
  },
  headers: { 
    type: String 
  },
  userId: { 
    type: String,
    index: true
  },
  statusCode: { 
    type: Number,
    index: true
  },
  responseTime: { 
    type: Number 
  },
  userAgent: { 
    type: String 
  },
  ip: { 
    type: String 
  }
}, {
  timestamps: true
});

// Create compound indexes for common queries
ApiLogSchema.index({ userId: 1, timestamp: -1 });
ApiLogSchema.index({ path: 1, timestamp: -1 });
ApiLogSchema.index({ statusCode: 1, timestamp: -1 });

// Check if the model already exists to prevent model overwrite error
const ApiLogModel = mongoose.models.ApiLog || mongoose.model<IApiLog>('ApiLog', ApiLogSchema);

export { ApiLogModel as ApiLog };
export default ApiLogModel;
