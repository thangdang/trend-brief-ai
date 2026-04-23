import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import cron from 'node-cron';
import { config } from '../config';
import { Article } from '../models/Article';
import { Interaction } from '../models/Interaction';
import { User } from '../models/User';
import {
  getUserTokens,
  canSendNotification,
  logNotification,
  sendPush,
  isDuplicate,
  markSent,
  markTopicCapSent,
  isTypeEnabled,
  getTargetUsersForTopic,
} from '../services/notification.service';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

// ── Queue ────────────────────────────────────────────────────────────────────
export const notificationQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendToUser(
  userId: string,
  articleId: string,
  type: string,
  payload: { title: string; body: string; data?: Record<string, string> },
  topicKey?: string,
): Promise<boolean> {
  // Global + per-type frequency cap
  if (!(await canSendNotification(userId, type, topicKey))) return false;

  // Dedup
  if (await isDuplicate(userId, articleId, type)) return false;

  const tokens = await getUserTokens(userId);
  if (tokens.length === 0) return false;

  let sent = false;
  for (const dt of tokens) {
    const ok = await sendPush(dt.token, payload);
    if (ok) sent = true;
  }

  if (sent) {
    await logNotification(userId, articleId, type);
    await markSent(userId, articleId, type);
    // Record per-topic cap for topic_update
    if (type === 'topic_update' && topicKey) {
      await markTopicCapSent(userId, topicKey);
    }
  }
  return sent;
}

// ── Job Processors ───────────────────────────────────────────────────────────

/** trending_check: articles with 1000+ views in the last hour */
async function processTrendingCheck(): Promise<{ sent: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Aggregate views per article in the last hour
  const trending = await Interaction.aggregate([
    { $match: { action: 'view', created_at: { $gte: oneHourAgo } } },
    { $group: { _id: '$article_id', viewCount: { $sum: 1 } } },
    { $match: { viewCount: { $gte: 1000 } } },
    { $sort: { viewCount: -1 } },
    { $limit: 5 },
  ]);

  if (trending.length === 0) return { sent: 0 };

  const articleIds = trending.map((t) => t._id);
  const articles = await Article.find({ _id: { $in: articleIds }, processing_status: 'done' }).lean();

  // Get all users who have trending notifications enabled
  const users = await User.find({
    notifications_enabled: true,
    'notification_prefs.trending': { $ne: false },
  })
    .select('_id notification_prefs')
    .lean();

  let sent = 0;
  for (const article of articles) {
    const payload = {
      title: '🔥 Đang hot',
      body: article.title_ai || article.title_original,
      data: { type: 'trending', articleId: article._id.toString(), deepLink: `/article/${article._id}` },
    };

    for (const user of users) {
      if (!isTypeEnabled(user.notification_prefs, 'trending')) continue;
      const ok = await sendToUser(user._id.toString(), article._id.toString(), 'trending', payload);
      if (ok) sent++;
    }
  }

  console.log(`[NotifScheduler] trending_check: ${sent} notifications sent for ${articles.length} articles`);
  return { sent };
}

/** daily_digest: top article by views + quality, sent at 8 AM */
async function processDailyDigest(): Promise<{ sent: number }> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find top article from last 24h by view count
  const topArticles = await Interaction.aggregate([
    { $match: { action: 'view', created_at: { $gte: oneDayAgo } } },
    { $group: { _id: '$article_id', viewCount: { $sum: 1 } } },
    { $sort: { viewCount: -1 } },
    { $limit: 1 },
  ]);

  if (topArticles.length === 0) return { sent: 0 };

  const article = await Article.findOne({
    _id: topArticles[0]._id,
    processing_status: 'done',
  }).lean();

  if (!article) return { sent: 0 };

  const users = await User.find({
    notifications_enabled: true,
    'notification_prefs.daily': { $ne: false },
  })
    .select('_id notification_prefs')
    .lean();

  let sent = 0;
  const payload = {
    title: '📰 Tin nổi bật hôm nay',
    body: article.title_ai || article.title_original,
    data: { type: 'daily_digest', articleId: article._id.toString(), deepLink: '/feed' },
  };

  for (const user of users) {
    if (!isTypeEnabled(user.notification_prefs, 'daily_digest')) continue;
    const ok = await sendToUser(user._id.toString(), article._id.toString(), 'daily_digest', payload);
    if (ok) sent++;
  }

  console.log(`[NotifScheduler] daily_digest: ${sent} notifications sent`);
  return { sent };
}

/** weekly_digest: top 5 articles of the week, sent Sunday 9 AM */
async function processWeeklyDigest(): Promise<{ sent: number }> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const topArticles = await Interaction.aggregate([
    { $match: { action: 'view', created_at: { $gte: oneWeekAgo } } },
    { $group: { _id: '$article_id', viewCount: { $sum: 1 } } },
    { $sort: { viewCount: -1 } },
    { $limit: 5 },
  ]);

  if (topArticles.length === 0) return { sent: 0 };

  const articleIds = topArticles.map((t) => t._id);
  const articles = await Article.find({ _id: { $in: articleIds }, processing_status: 'done' }).lean();

  if (articles.length === 0) return { sent: 0 };

  const users = await User.find({
    notifications_enabled: true,
    'notification_prefs.weekly': { $ne: false },
  })
    .select('_id notification_prefs')
    .lean();

  let sent = 0;
  const titles = articles.map((a) => a.title_ai || a.title_original).slice(0, 3);
  const bodyText = titles.join(' • ');
  // Use the first article as the representative for logging/dedup
  const primaryArticleId = articles[0]._id.toString();

  const payload = {
    title: '📋 Tổng hợp tuần này',
    body: bodyText,
    data: { type: 'weekly_digest', articleId: primaryArticleId, deepLink: '/feed' },
  };

  for (const user of users) {
    if (!isTypeEnabled(user.notification_prefs, 'weekly_digest')) continue;
    const ok = await sendToUser(user._id.toString(), primaryArticleId, 'weekly_digest', payload);
    if (ok) sent++;
  }

  console.log(`[NotifScheduler] weekly_digest: ${sent} notifications sent for ${articles.length} articles`);
  return { sent };
}

/** topic_update: 5+ new articles in a subscribed topic in the last 2 hours */
async function processTopicUpdate(): Promise<{ sent: number }> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Find topics with 5+ new articles in the last 2h
  const topicCounts = await Article.aggregate([
    { $match: { created_at: { $gte: twoHoursAgo }, processing_status: 'done', topic: { $ne: null } } },
    { $group: { _id: '$topic', count: { $sum: 1 }, latestArticle: { $first: '$$ROOT' } } },
    { $match: { count: { $gte: 5 } } },
  ]);

  if (topicCounts.length === 0) return { sent: 0 };

  let sent = 0;
  for (const tc of topicCounts) {
    const topicKey = tc._id as string;
    const latestArticle = tc.latestArticle;

    // Get users subscribed to this topic with topic notifications enabled
    const userIds = await getTargetUsersForTopic(topicKey);

    const payload = {
      title: `📌 ${tc.count} bài mới về ${topicKey}`,
      body: latestArticle.title_ai || latestArticle.title_original,
      data: { type: 'topic_update', articleId: latestArticle._id.toString(), deepLink: `/feed?topic=${topicKey}` },
    };

    for (const userId of userIds) {
      // Check user prefs
      const user = await User.findById(userId).select('notification_prefs').lean();
      if (!isTypeEnabled(user?.notification_prefs, 'topic_update')) continue;

      const ok = await sendToUser(userId, latestArticle._id.toString(), 'topic_update', payload, topicKey);
      if (ok) sent++;
    }
  }

  console.log(`[NotifScheduler] topic_update: ${sent} notifications sent for ${topicCounts.length} topics`);
  return { sent };
}

// ── Worker ───────────────────────────────────────────────────────────────────

type NotificationJobType = 'trending_check' | 'daily_digest' | 'weekly_digest' | 'topic_update';

const notificationWorker = new Worker(
  'notifications',
  async (job: Job) => {
    const jobType = job.name as NotificationJobType;
    console.log(`[NotifWorker] Processing ${jobType} job ${job.id}`);

    switch (jobType) {
      case 'trending_check':
        return processTrendingCheck();
      case 'daily_digest':
        return processDailyDigest();
      case 'weekly_digest':
        return processWeeklyDigest();
      case 'topic_update':
        return processTopicUpdate();
      default:
        console.warn(`[NotifWorker] Unknown job type: ${jobType}`);
        return { sent: 0 };
    }
  },
  { connection, concurrency: 1 },
);

notificationWorker.on('failed', (job, err) => {
  console.error(`[NotifWorker] Job ${job?.name}/${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

notificationWorker.on('completed', (job, result) => {
  console.log(`[NotifWorker] Job ${job.name}/${job.id} completed:`, result);
});

// ── Cron Scheduler ───────────────────────────────────────────────────────────

export function startNotificationScheduler(): void {
  console.log('[NotifScheduler] Starting notification cron jobs...');

  // trending_check: every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await notificationQueue.add('trending_check', {}, { jobId: `trending-${Date.now()}` });
      console.log('[NotifScheduler] Enqueued trending_check job');
    } catch (err: any) {
      console.error('[NotifScheduler] Failed to enqueue trending_check:', err.message);
    }
  });
  console.log('[NotifScheduler] trending_check scheduled: every 30 min');

  // daily_digest: 8 AM daily
  cron.schedule('0 8 * * *', async () => {
    try {
      await notificationQueue.add('daily_digest', {}, { jobId: `daily-${Date.now()}` });
      console.log('[NotifScheduler] Enqueued daily_digest job');
    } catch (err: any) {
      console.error('[NotifScheduler] Failed to enqueue daily_digest:', err.message);
    }
  });
  console.log('[NotifScheduler] daily_digest scheduled: 8 AM daily');

  // weekly_digest: Sunday 9 AM
  cron.schedule('0 9 * * 0', async () => {
    try {
      await notificationQueue.add('weekly_digest', {}, { jobId: `weekly-${Date.now()}` });
      console.log('[NotifScheduler] Enqueued weekly_digest job');
    } catch (err: any) {
      console.error('[NotifScheduler] Failed to enqueue weekly_digest:', err.message);
    }
  });
  console.log('[NotifScheduler] weekly_digest scheduled: Sunday 9 AM');

  // topic_update: every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    try {
      await notificationQueue.add('topic_update', {}, { jobId: `topic-${Date.now()}` });
      console.log('[NotifScheduler] Enqueued topic_update job');
    } catch (err: any) {
      console.error('[NotifScheduler] Failed to enqueue topic_update:', err.message);
    }
  });
  console.log('[NotifScheduler] topic_update scheduled: every 2h');
}
