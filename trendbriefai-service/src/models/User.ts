import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSettings {
  theme: 'light' | 'dark' | 'system';
}

export interface INotificationPrefs {
  trending: boolean;
  topic: boolean;
  daily: boolean;
  weekly: boolean;
}

export interface IUser extends Document {
  email: string;
  password_hash: string;
  interests: string[];
  onboarding_completed: boolean;
  notifications_enabled: boolean;
  notification_prefs: INotificationPrefs;
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
    is_banned: {
      type: Boolean,
      default: false,
    },
    is_suspended: {
      type: Boolean,
      default: false,
    },
    referral_code: { type: String, unique: true, sparse: true },
    referred_by: { type: String },
    referral_count: { type: Number, default: 0 },
    premium_until: { type: Date },
    streak_count: { type: Number, default: 0 },
    last_active_date: { type: Date },
    notification_prefs: {
      trending: { type: Boolean, default: true },
      topic: { type: Boolean, default: true },
      daily: { type: Boolean, default: true },
      weekly: { type: Boolean, default: true },
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
