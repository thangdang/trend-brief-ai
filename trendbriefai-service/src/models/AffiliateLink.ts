import mongoose, { Schema, Document } from 'mongoose';
import { Topic } from '../types/api.types';

export interface IAffiliateLink extends Document {
  title: string;
  url: string;
  topic: Topic;
  commission: string;
  provider: string;
  is_active: boolean;
  clicks: number;
  impressions: number;
  conversions: number;
  created_at: Date;
}

const AffiliateLinkSchema = new Schema<IAffiliateLink>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    topic: {
      type: String,
      enum: ['ai', 'finance', 'lifestyle', 'drama'],
      required: true,
    },
    commission: { type: String, required: true },
    provider: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

AffiliateLinkSchema.index({ topic: 1, is_active: 1 });

export const AffiliateLinkModel = mongoose.model<IAffiliateLink>('AffiliateLink', AffiliateLinkSchema);
