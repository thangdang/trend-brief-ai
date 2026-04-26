import mongoose, { Schema, Document } from 'mongoose';

export type SourceType = 'rss' | 'html_scrape' | 'api';

export interface IRssSource extends Document {
  name: string;
  url: string;
  category?: string;
  source_type: SourceType;
  is_active: boolean;
  crawl_interval_minutes: number;
  last_crawled_at?: Date;
  scrape_link_selector?: string;
  scrape_content_selector?: string;
  created_at: Date;
  // Health tracking
  health?: {
    success_count_24h: number;
    total_count_24h: number;
    success_rate: number;
    consecutive_failures: number;
    last_successful_at?: Date;
    last_error?: string;
    auto_disabled: boolean;
    disabled_until?: Date;
  };
}

const RssSourceSchema = new Schema<IRssSource>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    category: String,
    source_type: {
      type: String,
      enum: ['rss', 'html_scrape', 'api'],
      default: 'rss',
      required: true,
    },
    is_active: { type: Boolean, default: true },
    crawl_interval_minutes: { type: Number, default: 10, min: 1 },
    last_crawled_at: Date,
    scrape_link_selector: String,
    scrape_content_selector: String,
    health: {
      type: {
        success_count_24h: { type: Number, default: 0 },
        total_count_24h: { type: Number, default: 0 },
        success_rate: { type: Number, default: 1.0 },
        consecutive_failures: { type: Number, default: 0 },
        last_successful_at: Date,
        last_error: String,
        auto_disabled: { type: Boolean, default: false },
        disabled_until: Date,
      },
      default: () => ({
        success_count_24h: 0, total_count_24h: 0, success_rate: 1.0,
        consecutive_failures: 0, auto_disabled: false,
      }),
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

RssSourceSchema.index({ is_active: 1 });
RssSourceSchema.index({ source_type: 1 });

export const RssSource = mongoose.model<IRssSource>('RssSource', RssSourceSchema);
