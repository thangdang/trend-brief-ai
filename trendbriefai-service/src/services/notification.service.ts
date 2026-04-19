import { DeviceToken } from '../models/DeviceToken';
import { NotificationLog } from '../models/NotificationLog';
import { User } from '../models/User';

const MAX_NOTIFICATIONS_PER_DAY = 3;

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

export async function canSendNotification(userId: string): Promise<boolean> {
  const user = await User.findById(userId).lean();
  if (!user?.notifications_enabled) return false;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sentToday = await NotificationLog.countDocuments({
    user_id: userId,
    sent_at: { $gte: todayStart },
  });

  return sentToday < MAX_NOTIFICATIONS_PER_DAY;
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
