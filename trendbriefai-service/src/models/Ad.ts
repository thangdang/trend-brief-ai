import mongoose, { Schema, Document } from 'mongoose';
import { Topic, AdStatus } from '../types/api.types';

export interface IAd extends Document {
  title: string;
  description: string;
  image_url?: string;
  target_url: string;
  advertiser: string;
  topic: Topic;
  status: AdStatus;
  start_date: Date;
  end_date: Date;
  impressions: number;
  clicks: number;
  budget_cents: number;
  spent_cents: number;
  created_at: Date;
}

const AdSchema = new Schema<IAd>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    image_url: { type: String },
    target_url: { type: String, required: true },
    advertiser: { type: String, required: true },
    topic: {
      type: String,
      enum: ['ai', 'finance', 'lifestyle', 'drama'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'expired'],
      default: 'active',
      required: true,
    },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    budget_cents: { type: Number, required: true },
    spent_cents: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

AdSchema.index({ status: 1, topic: 1 });
AdSchema.index({ end_date: 1 });

export const Ad = mongoose.model<IAd>('Ad', AdSchema);
