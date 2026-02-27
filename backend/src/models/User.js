import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    planId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'cancelled'],
      default: 'active',
    },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });

export const User = mongoose.model('User', userSchema);

/** Hash plain password for storage. Use when creating a new user. */
export function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

/** Compare plain password with stored hash. */
export function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
