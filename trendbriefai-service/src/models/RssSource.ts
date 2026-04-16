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
  /** CSS selector to find article links on a listing page (html_scrape only). */
  scrape_link_selector?: string;
  /** CSS selector to extract article body (html_scrape only). */
  scrape_content_selector?: string;
  created_at: Date;
}

const RssSourceSchema = new Schema<IRssSource>(
  {
    name: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    category: String,
    source_type: {
      type: String,
      enum: ['rss', 'html_scrape', 'api'],
      default: 'rss',
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    crawl_interval_minutes: {
      type: Number,
      default: 10,
      min: 1,
    },
    last_crawled_at: Date,
    scrape_link_selector: String,
    scrape_content_selector: String,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

RssSourceSchema.index({ is_active: 1 });
RssSourceSchema.index({ source_type: 1 });

export const RssSource = mongoose.model<IRssSource>('RssSource', RssSourceSchema);
