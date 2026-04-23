import { DeviceToken } from '../models/DeviceToken';
import { NotificationLog } from '../models/NotificationLog';
import { User, INotificationPrefs } from '../models/User';
import IORedis from 'ioredis';
import { config } from '../config';

const MAX_NOTIFICATIONS_PER_DAY = 3;
const DEDUP_TTL_SECONDS = 24 * 60 * 60; // 24h

// ── Per-type frequency caps (Task 26.3) ──────────────────────────────────────
const TYPE_CAPS: Record<string, { max: number; windowMs: number }> = {
  trending:      { max: 3, windowMs: 24 * 60 * 60 * 1000 },       // 3/day
  topic_update:  { max: 1, windowMs: 24 * 60 * 60 * 1000 },       // 1/topic/day (per-topic checked separately)
  daily_digest:  { max: 1, windowMs: 24 * 60 * 60 * 1000 },       // 1/day
  weekly_digest: { max: 1, windowMs: 7 * 24 * 60 * 60 * 1000 },   // 1/week
};

let redisClient: IORedis | null = null;

function getRedis(): IORedis {
  if (!redisClient) {
    redisClient = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  }
  return redisClient;
}

/** Check if this notification was already sent (Redis 24h dedup) */
export async function isDuplicate(userId: string, articleId: string, type: string): Promise<boolean> {
  try {
    const key = `notif:dedup:${userId}:${articleId}:${type}`;
    const exists = await getRedis().exists(key);
    return exists === 1;
  } catch {
    return false; // graceful degradation
  }
}

/** Mark notification as sent in Redis for dedup */
export async function markSent(userId: string, articleId: string, type: string): Promise<void> {
  try {
    const key = `notif:dedup:${userId}:${articleId}:${type}`;
    await getRedis().set(key, '1', 'EX', DEDUP_TTL_SECONDS);
  } catch {
    // graceful degradation
  }
}

/** Send push notification via FCM (placeholder — real FCM requires firebase-admin) */
export async function sendPush(
  token: string,
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<boolean> {
  try {
    // In production, use firebase-admin SDK:
    // import * as admin from 'firebase-admin';
    // await admin.messaging().send({ token, notification: { title, body }, data });
    console.log(`[FCM] Sending to token ${token.slice(0, 12)}...: ${payload.title}`);
    return true;
  } catch (err: any) {
    console.error(`[FCM] Failed to send push:`, err.message);
    return false;
  }
}

/** Check if user has opted in for a specific notification type */
export function isTypeEnabled(prefs: Partial<INotificationPrefs> | undefined, type: string): boolean {
  if (!prefs) return true; // default: all enabled
  const prefMap: Record<string, keyof INotificationPrefs> = {
    trending: 'trending',
    topic_update: 'topic',
    daily_digest: 'daily',
    weekly_digest: 'weekly',
  };
  const key = prefMap[type];
  if (!key) return true;
  return prefs[key] !== false;
}

export async function registerToken(userId: string, token: string, platform: 'ios' | 'android') {
  await DeviceToken.findOneAndUpdate(
    { token },
    { user_id: userId, token, platform },
    { upsert: true, new: true }
  );
}

export async function unregisterToken(token: string) {
  await DeviceToken.deleteOne({ token });
}

export async function getUserTokens(userId: string) {
  return DeviceToken.find({ user_id: userId }).lean();
}

/**
 * Check global daily cap AND per-type frequency cap.
 * @param type - notification type for per-type cap lookup
 * @param topicKey - optional topic key for topic_update (1/topic/day)
 */
export async function canSendNotification(
  userId: string,
  type?: string,
  topicKey?: string,
): Promise<boolean> {
  const user = await User.findById(userId).lean();
  if (!user?.notifications_enabled) return false;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Global daily cap (3/day across all types)
  const sentToday = await NotificationLog.countDocuments({
    user_id: userId,
    sent_at: { $gte: todayStart },
  });
  if (sentToday >= MAX_NOTIFICATIONS_PER_DAY) return false;

  // Per-type frequency cap
  if (type && TYPE_CAPS[type]) {
    const cap = TYPE_CAPS[type];
    const windowStart = new Date(Date.now() - cap.windowMs);

    // For topic_update, use Redis key per-topic to enforce 1/topic/day
    if (type === 'topic_update' && topicKey) {
      try {
        const key = `notif:cap:${userId}:topic_update:${topicKey}`;
        const exists = await getRedis().exists(key);
        if (exists === 1) return false;
      } catch {
        // graceful degradation — fall through to Mongo check
      }
    }

    const sentInWindow = await NotificationLog.countDocuments({
      user_id: userId,
      type,
      sent_at: { $gte: windowStart },
    });
    if (sentInWindow >= cap.max) return false;
  }

  return true;
}

/**
 * Record per-topic cap in Redis after sending a topic_update notification.
 */
export async function markTopicCapSent(userId: string, topicKey: string): Promise<void> {
  try {
    const key = `notif:cap:${userId}:topic_update:${topicKey}`;
    const ttl = Math.floor(TYPE_CAPS.topic_update.windowMs / 1000);
    await getRedis().set(key, '1', 'EX', ttl);
  } catch {
    // graceful degradation
  }
}

export async function logNotification(userId: string, articleId: string, type: string) {
  await NotificationLog.create({
    user_id: userId,
    article_id: articleId,
    type,
    sent_at: new Date(),
  });
}

export async function getTargetUsersForTopic(topicKey: string): Promise<string[]> {
  const users = await User.find({
    interests: topicKey,
    notifications_enabled: true,
  }).select('_id').lean();
  return users.map((u) => u._id.toString());
}

/** Get notification logs for a user (paginated, most recent first). */
export async function getNotificationLogs(
  userId: string,
  page = 1,
  limit = 20,
): Promise<{ logs: any[]; total: number; page: number; totalPages: number }> {
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    NotificationLog.find({ user_id: userId })
      .sort({ sent_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('article_id', 'title_ai title_original')
      .lean(),
    NotificationLog.countDocuments({ user_id: userId }),
  ]);
  return { logs, total, page, totalPages: Math.ceil(total / limit) };
}

/** Mark a notification as opened. */
export async function markNotificationOpened(logId: string): Promise<void> {
  await NotificationLog.findByIdAndUpdate(logId, { opened_at: new Date() });
}
