import mongoose from 'mongoose';

const supabaseConfigSchema = new mongoose.Schema({
  configName: {
    type: String,
    required: true,
    trim: true
  },
  supabaseUrl: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/.test(v);
      },
      message: 'Invalid Supabase URL format'
    }
  },
  supabaseAnonKey: {
    type: String,
    required: true
  },
  supabaseServiceKey: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  testConnection: {
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending'
    },
    lastTested: Date,
    errorMessage: String
  }
}, {
  timestamps: true
});

// Ensure only one active config per firm
supabaseConfigSchema.pre('save', async function(next) {
  if (this.isActive) {
    await this.constructor.updateMany(
      { firmId: this.firmId, _id: { $ne: this._id } },
      { isActive: false }
    );
  }
  next();
});

// Encrypt sensitive keys before saving
supabaseConfigSchema.pre('save', function(next) {
  if (this.isModified('supabaseServiceKey')) {
    // In production, implement proper encryption
    // For now, we'll store as-is but mark for encryption
    this.supabaseServiceKey = `encrypted:${this.supabaseServiceKey}`;
  }
  next();
});

// Decrypt keys when retrieving
supabaseConfigSchema.methods.getDecryptedServiceKey = function() {
  if (this.supabaseServiceKey.startsWith('encrypted:')) {
    return this.supabaseServiceKey.replace('encrypted:', '');
  }
  return this.supabaseServiceKey;
};

const SupabaseConfig = mongoose.models.SupabaseConfig || mongoose.model('SupabaseConfig', supabaseConfigSchema);

export default SupabaseConfig;