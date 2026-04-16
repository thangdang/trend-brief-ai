import mongoose, { Schema, Document } from 'mongoose';
import { Topic } from '../types/api.types';

export interface IUser extends Document {
  email: string;
  password_hash: string;
  interests: Topic[];
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    interests: {
      type: [String],
      enum: ['ai', 'finance', 'lifestyle', 'drama'],
      default: [],
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
