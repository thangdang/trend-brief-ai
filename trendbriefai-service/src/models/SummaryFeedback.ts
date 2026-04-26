import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISummaryFeedback extends Document {
  user_id: Types.ObjectId | null;
  article_id: Types.ObjectId;
  rating: 'up' | 'down';
  reason?: string;
  ip_hash?: string;
  created_at: Date;
}

const SummaryFeedbackSchema = new Schema<ISummaryFeedback>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    article_id: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
    rating: { type: String, enum: ['up', 'down'], required: true },
    reason: { type: String },
    ip_hash: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

SummaryFeedbackSchema.index({ article_id: 1, user_id: 1 }, { unique: true, sparse: true });
SummaryFeedbackSchema.index({ article_id: 1, ip_hash: 1 }, { unique: true, sparse: true });
SummaryFeedbackSchema.index({ created_at: -1 });

export const SummaryFeedback = mongoose.model<ISummaryFeedback>('SummaryFeedback', SummaryFeedbackSchema);
