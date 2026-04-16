import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalytics extends Document {
  date: string;
  total_views: number;
  unique_users: number;
  total_clicks: number;
  total_shares: number;
  total_bookmarks: number;
  ad_impressions: number;
  ad_clicks: number;
  affiliate_clicks: number;
  affiliate_impressions: number;
  created_at: Date;
}

const AnalyticsSchema = new Schema<IAnalytics>(
  {
    date: { type: String, required: true },
    total_views: { type: Number, default: 0 },
    unique_users: { type: Number, default: 0 },
    total_clicks: { type: Number, default: 0 },
    total_shares: { type: Number, default: 0 },
    total_bookmarks: { type: Number, default: 0 },
    ad_impressions: { type: Number, default: 0 },
    ad_clicks: { type: Number, default: 0 },
    affiliate_clicks: { type: Number, default: 0 },
    affiliate_impressions: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

AnalyticsSchema.index({ date: 1 }, { unique: true });

export const Analytics = mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);
