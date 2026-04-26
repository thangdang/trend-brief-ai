import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  user_id: mongoose.Types.ObjectId;
  order_id: string;
  amount: number;
  currency: string;
  method: 'momo' | 'vnpay' | 'apple_iap' | 'google_play' | 'stripe';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  provider_transaction_id: string | null;
  plan: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

const PaymentSchema = new Schema<IPayment>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  order_id: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'VND' },
  method: { type: String, required: true, enum: ['momo', 'vnpay', 'apple_iap', 'google_play', 'stripe'] },
  status: { type: String, default: 'pending', enum: ['pending', 'completed', 'failed', 'refunded'] },
  provider_transaction_id: { type: String, default: null },
  plan: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

PaymentSchema.index({ order_id: 1 });
PaymentSchema.index({ user_id: 1, status: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
