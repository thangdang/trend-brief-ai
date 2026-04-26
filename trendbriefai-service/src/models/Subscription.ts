import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  user_id: mongoose.Types.ObjectId;
  plan: 'free' | 'pro_monthly' | 'pro_yearly';
  price: number;
  payment_method: 'momo' | 'vnpay' | 'apple_iap' | 'google_play' | 'stripe' | 'referral' | 'streak';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  trial_used: boolean;
  auto_renew: boolean;
  starts_at: Date;
  expires_at: Date;
  cancelled_at: Date | null;
  created_at: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan: { type: String, required: true, enum: ['free', 'pro_monthly', 'pro_yearly'] },
  price: { type: Number, default: 0 },
  payment_method: { type: String, enum: ['momo', 'vnpay', 'apple_iap', 'google_play', 'stripe', 'referral', 'streak'] },
  status: { type: String, default: 'active', enum: ['active', 'cancelled', 'expired', 'trial'] },
  trial_used: { type: Boolean, default: false },
  auto_renew: { type: Boolean, default: false },
  starts_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true },
  cancelled_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
});

SubscriptionSchema.index({ user_id: 1, status: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
