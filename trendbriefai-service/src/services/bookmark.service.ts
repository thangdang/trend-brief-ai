import mongoose from 'mongoose';
import { Bookmark, IBookmark } from '../models/Bookmark';

export async function addBookmark(
  userId: string,
  articleId: string
): Promise<{ bookmark: IBookmark; created: boolean }> {
  try {
    const bookmark = await Bookmark.create({
      user_id: new mongoose.Types.ObjectId(userId),
      article_id: new mongoose.Types.ObjectId(articleId),
    });
    return { bookmark, created: true };
  } catch (err: any) {
    if (err.code === 11000) {
      const existing = await Bookmark.findOne({
        user_id: new mongoose.Types.ObjectId(userId),
        article_id: new mongoose.Types.ObjectId(articleId),
      });
      return { bookmark: existing!, created: false };
    }
    throw err;
  }
}

export async function removeBookmark(
  bookmarkId: string,
  userId: string
): Promise<boolean> {
  const result = await Bookmark.deleteOne({
    _id: new mongoose.Types.ObjectId(bookmarkId),
    user_id: new mongoose.Types.ObjectId(userId),
  });
  return result.deletedCount > 0;
}

export async function getBookmarks(
  userId: string,
  page: number,
  limit: number
): Promise<{ bookmarks: IBookmark[]; total: number; page: number; totalPages: number }> {
  const skip = (page - 1) * limit;

  const [bookmarks, total] = await Promise.all([
    Bookmark.find({ user_id: new mongoose.Types.ObjectId(userId) })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('article_id'),
    Bookmark.countDocuments({ user_id: new mongoose.Types.ObjectId(userId) }),
  ]);

  return {
    bookmarks,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
