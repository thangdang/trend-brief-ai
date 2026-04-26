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
  password_hash: string | null;
  name: string;
  provider: 'email' | 'google' | 'apple';
  google_id: string | null;
  apple_id: string | null;
  avatar_url: string | null;
  interests: string[];
  onboarding_completed: boolean;
  notifications_enabled: boolean;
  notification_prefs: INotificationPrefs;
  settings: IUserSettings;
  is_banned: boolean;
  is_suspended: boolean;
  referral_code: string | null;
  referred_by: string | null;
  referral_count: number;
  premium_until: Date | null;
  trial_used: boolean;
  streak_count: number;
  last_active_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password_hash: { type: String, default: null },
    name: { type: String, default: '' },
    provider: { type: String, enum: ['email', 'google', 'apple'], default: 'email' },
    google_id: { type: String, default: null, sparse: true },
    apple_id: { type: String, default: null, sparse: true },
    avatar_url: { type: String, default: null },
    interests: { type: [String], default: [] },
    onboarding_completed: { type: Boolean, default: false },
    notifications_enabled: { type: Boolean, default: true },
    is_banned: { type: Boolean, default: false },
    is_suspended: { type: Boolean, default: false },
    referral_code: { type: String, unique: true, sparse: true },
    referred_by: { type: String },
    referral_count: { type: Number, default: 0 },
    premium_until: { type: Date },
    trial_used: { type: Boolean, default: false },
    streak_count: { type: Number, default: 0 },
    last_active_date: { type: Date },
    notification_prefs: {
      trending: { type: Boolean, default: true },
      topic: { type: Boolean, default: true },
      daily: { type: Boolean, default: true },
      weekly: { type: Boolean, default: true },
    },
    settings: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const User = mongoose.model<IUser>('User', UserSchema);
