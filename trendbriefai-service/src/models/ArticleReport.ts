import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IArticleReport extends Document {
  article_id: Types.ObjectId;
  user_id: Types.ObjectId;
  reason: string;
  created_at: Date;
}

const ArticleReportSchema = new Schema<IArticleReport>(
  {
    article_id: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

ArticleReportSchema.index({ article_id: 1 });
ArticleReportSchema.index({ user_id: 1, article_id: 1 }, { unique: true }); // 1 report per user per article

export const ArticleReport = mongoose.model<IArticleReport>('ArticleReport', ArticleReportSchema);
