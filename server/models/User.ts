// server/models/User.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  fullname: string;
  password: string;
  role: 'user' | 'manager' | 'admin' | 'sub-contractor'; // Legacy field - kept for backward compatibility
  roleId?: string; // UUID reference to Role model
  firmId: mongoose.Types.ObjectId;
  status: number; // 0: pending, 1: approved, -1: rejected
  lastmailsent?: Date; // Optional
  lastLogin?: Date; // Optional

  // Password reset fields
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  // Account lockout fields
  failedLoginAttempts?: number;
  accountLockedUntil?: Date;

  // Session security fields
  activeSessions?: string[]; // Array of session IDs
  lastPasswordChange?: Date;
  passwordHistory?: string[]; // Store hashed passwords to prevent reuse

  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema: Schema<IUser> = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  fullname: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'manager', 'admin', 'sub-contractor'], default: 'user' }, // Legacy field - kept for backward compatibility
  roleId: { type: String, ref: 'Role' }, // UUID reference to Role model
  firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true },
  status: { type: Number, enum: [-1, 0, 1], default: 0 }, // 0: pending, 1: approved, -1: rejected
  lastmailsent: { type: Date },
  lastLogin: { type: Date },

  // Password reset fields
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },

  // Account lockout fields
  failedLoginAttempts: { type: Number, default: 0 },
  accountLockedUntil: { type: Date },

  // Session security fields
  activeSessions: [{ type: String }], // Array of session IDs
  lastPasswordChange: { type: Date, default: Date.now },
  passwordHistory: [{ type: String }], // Store hashed passwords to prevent reuse
},
{
  timestamps: true,
});

// Add instance methods for account lockout and security
UserSchema.methods.isAccountLocked = function(): boolean {
  return !!(this.accountLockedUntil && this.accountLockedUntil > new Date());
};

UserSchema.methods.incrementFailedAttempts = function(): Promise<IUser> {
  // If we have a previous lock that has expired, restart at 1
  if (this.accountLockedUntil && this.accountLockedUntil < new Date()) {
    return this.updateOne({
      $unset: { accountLockedUntil: 1 },
      $set: { failedLoginAttempts: 1 }
    });
  }

  const updates: any = { $inc: { failedLoginAttempts: 1 } };

  // Lock account after 5 failed attempts for 30 minutes
  if (this.failedLoginAttempts + 1 >= 5 && !this.isAccountLocked()) {
    updates.$set = { accountLockedUntil: new Date(Date.now() + 30 * 60 * 1000) }; // 30 minutes
  }

  return this.updateOne(updates);
};

UserSchema.methods.resetFailedAttempts = function(): Promise<IUser> {
  return this.updateOne({
    $unset: { failedLoginAttempts: 1, accountLockedUntil: 1 }
  });
};

UserSchema.methods.addToPasswordHistory = function(hashedPassword: string): void {
  if (!this.passwordHistory) {
    this.passwordHistory = [];
  }

  // Keep only last 5 passwords
  this.passwordHistory.unshift(hashedPassword);
  if (this.passwordHistory.length > 5) {
    this.passwordHistory = this.passwordHistory.slice(0, 5);
  }
};

UserSchema.methods.isPasswordInHistory = function(hashedPassword: string): boolean {
  if (!this.passwordHistory || this.passwordHistory.length === 0) {
    return false;
  }
  return this.passwordHistory.includes(hashedPassword);
};

// Avoid model recompilation during hot-reloads
export default (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);