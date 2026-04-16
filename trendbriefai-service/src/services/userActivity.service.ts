import mongoose from 'mongoose';
import { UserActivity, IUserActivity } from '../models/UserActivity';
import { User } from '../models/User';

/**
 * Record that a user was active right now.
 * Upserts a UserActivity doc for today — increments sessions on first call,
 * always updates last_seen_at.
 */
export async function recordActivity(userId: string): Promise<void> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  await UserActivity.findOneAndUpdate(
    { user_id: new mongoose.Types.ObjectId(userId), date: dateStr },
    {
      $set: { last_seen_at: now },
      $setOnInsert: { first_seen_at: now },
      $inc: { sessions: 1 },
    },
    { upsert: true },
  );
}

/**
 * Increment articles_viewed for today's activity record.
 */
export async function recordArticleView(userId: string): Promise<void> {
  const dateStr = new Date().toISOString().slice(0, 10);
  await UserActivity.findOneAndUpdate(
    { user_id: new mongoose.Types.ObjectId(userId), date: dateStr },
    { $inc: { articles_viewed: 1 } },
  );
}

/**
 * Get DAU (Daily Active Users) for a specific date.
 */
export async function getDAU(date: string): Promise<number> {
  return UserActivity.countDocuments({ date });
}

/**
 * Get MAU (Monthly Active Users) for a given month (YYYY-MM).
 */
export async function getMAU(yearMonth: string): Promise<number> {
  const startDate = `${yearMonth}-01`;
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  const result = await UserActivity.aggregate([
    { $match: { date: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: '$user_id' } },
    { $count: 'mau' },
  ]);

  return result[0]?.mau ?? 0;
}

/**
 * Get D7 retention: of users who were active on `cohortDate`,
 * how many were also active 7 days later?
 */
export async function getRetentionD7(cohortDate: string): Promise<{
  cohortSize: number;
  retainedCount: number;
  retentionRate: number;
}> {
  // Parse cohort date and compute D7 date
  const d = new Date(cohortDate);
  d.setDate(d.getDate() + 7);
  const d7Date = d.toISOString().slice(0, 10);

  // Users active on cohort date
  const cohortUsers = await UserActivity.distinct('user_id', { date: cohortDate });
  const cohortSize = cohortUsers.length;

  if (cohortSize === 0) {
    return { cohortSize: 0, retainedCount: 0, retentionRate: 0 };
  }

  // Of those, how many were active on D7?
  const retainedCount = await UserActivity.countDocuments({
    user_id: { $in: cohortUsers },
    date: d7Date,
  });

  return {
    cohortSize,
    retainedCount,
    retentionRate: Math.round((retainedCount / cohortSize) * 10000) / 100, // e.g. 45.23%
  };
}

/**
 * Get average sessions per user per day for a date range.
 */
export async function getAvgSessionsPerUser(
  startDate: string,
  endDate: string,
): Promise<number> {
  const result = await UserActivity.aggregate([
    { $match: { date: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: null, avgSessions: { $avg: '$sessions' }, avgArticles: { $avg: '$articles_viewed' } } },
  ]);

  return result[0]?.avgSessions ?? 0;
}

/**
 * Get average articles viewed per user per day for a date range.
 */
export async function getAvgArticlesPerUser(
  startDate: string,
  endDate: string,
): Promise<number> {
  const result = await UserActivity.aggregate([
    { $match: { date: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: null, avg: { $avg: '$articles_viewed' } } },
  ]);

  return result[0]?.avg ?? 0;
}
