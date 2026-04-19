import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSettings {
  theme: 'light' | 'dark' | 'system';
}

export interface IUser extends Document {
  email: string;
  password_hash: string;
  interests: string[];
  onboarding_completed: boolean;
  notifications_enabled: boolean;
  settings: IUserSettings;
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
      default: [],
    },
    onboarding_completed: {
      type: Boolean,
      default: false,
    },
    notifications_enabled: {
      type: Boolean,
      default: true,
    },
    settings: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
