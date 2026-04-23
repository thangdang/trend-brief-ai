import mongoose, { Schema, Document, Types } from 'mongoose';

export type ReactionType = '🔥' | '😮' | '😢' | '😡';

export interface IReaction extends Document {
  article_id: Types.ObjectId;
  user_id: Types.ObjectId;
  type: ReactionType;
  created_at: Date;
}

const ReactionSchema = new Schema<IReaction>(
  {
    article_id: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['🔥', '😮', '😢', '😡'], required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

ReactionSchema.index({ article_id: 1 });
ReactionSchema.index({ user_id: 1, article_id: 1 }, { unique: true }); // 1 reaction per user per article

export const Reaction = mongoose.model<IReaction>('Reaction', ReactionSchema);
