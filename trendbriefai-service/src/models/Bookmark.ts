import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBookmark extends Document {
  user_id: Types.ObjectId;
  article_id: Types.ObjectId;
  created_at: Date;
}

const BookmarkSchema = new Schema<IBookmark>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    article_id: {
      type: Schema.Types.ObjectId,
      ref: 'Article',
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

BookmarkSchema.index({ user_id: 1, article_id: 1 }, { unique: true });
BookmarkSchema.index({ user_id: 1, created_at: -1 });

export const Bookmark = mongoose.model<IBookmark>('Bookmark', BookmarkSchema);
