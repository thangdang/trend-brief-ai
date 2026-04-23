import mongoose, { Schema, Document, Types } from 'mongoose';
import { Topic, ProcessingStatus } from '../types/api.types';

export interface IArticle extends Document {
  url: string;
  url_hash: string;
  title_original: string;
  title_ai?: string;
  summary_bullets?: string[];
  reason?: string;
  content_clean?: string;
  topic?: Topic;
  image_url?: string;
  source: string;
  published_at?: Date;
  embedding?: number[];
  cluster_id?: Types.ObjectId;
  processing_status: ProcessingStatus;
  is_sponsored: boolean;
  sponsor_name?: string;
  sponsor_url?: string;
  created_at: Date;
}

const ArticleSchema = new Schema<IArticle>(
  {
    url: {
      type: String,
      required: true,
      unique: true,
    },
    url_hash: {
      type: String,
      required: true,
      unique: true,
      minlength: 32,
      maxlength: 32,
    },
    title_original: {
      type: String,
      required: true,
    },
    title_ai: String,
    summary_bullets: {
      type: [String],
      validate: {
        validator: (v: string[]) => !v.length || v.length === 3,
        message: 'summary_bullets must have exactly 3 items when present',
      },
    },
    reason: String,
    content_clean: String,
    topic: {
      type: String,
      enum: ['ai', 'finance', 'lifestyle', 'drama', 'career', 'insight'],
    },
    image_url: String,
    source: {
      type: String,
      required: true,
    },
    published_at: Date,
    embedding: {
      type: [Number],
    },
    cluster_id: {
      type: Schema.Types.ObjectId,
      ref: 'Cluster',
    },
    processing_status: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed', 'fallback'],
      default: 'pending',
      required: true,
    },
    is_sponsored: {
      type: Boolean,
      default: false,
    },
    sponsor_name: { type: String },
    sponsor_url: { type: String },
    report_count: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

ArticleSchema.index({ topic: 1 });
ArticleSchema.index({ created_at: -1 });
ArticleSchema.index({ source: 1 });
ArticleSchema.index({ processing_status: 1 });
ArticleSchema.index({ title_original: 'text', title_ai: 'text' });

export const Article = mongoose.model<IArticle>('Article', ArticleSchema);
