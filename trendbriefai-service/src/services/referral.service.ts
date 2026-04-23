import { User } from '../models/User';
import { Referral } from '../models/Referral';
import crypto from 'crypto';

const MAX_REFERRALS_PER_MONTH = 10;
const PREMIUM_REWARD_DAYS = 7;

/** Generate a unique referral code for a user (Task 30.1) */
export async function generateReferralCode(userId: string): Promise<string> {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  if (user.referral_code) return user.referral_code;

  // Generate code: first part of email + random suffix
  const prefix = user.email.split('@')[0].slice(0, 8).toUpperCase();
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  const code = `${prefix}_TB${suffix}`;

  await User.findByIdAndUpdate(userId, { referral_code: code });
  return code;
}

/** Get referral code for a user */
export async function getReferralCode(userId: string): Promise<string | null> {
  const user = await User.findById(userId).select('referral_code').lean();
  return user?.referral_code || null;
}

/** Apply referral on signup (Task 30.4) */
export async function applyReferral(newUserId: string, referralCode: string): Promise<boolean> {
  // Find referrer
  const referrer = await User.findOne({ referral_code: referralCode }).lean();
  if (!referrer) return false;

  // Check monthly cap (Task 30.5)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthlyCount = await Referral.countDocuments({
    referrer_id: referrer._id,
    created_at: { $gte: monthStart },
  });

  if (monthlyCount >= MAX_REFERRALS_PER_MONTH) return false;

  // Check if already referred
  const existing = await Referral.findOne({ referee_id: newUserId });
  if (existing) return false;

  // Create referral record
  await Referral.create({
    referrer_id: referrer._id,
    referee_id: newUserId,
    code: referralCode,
    reward_granted: true,
  });

  // Grant 7-day Premium to both
  const premiumUntil = new Date(Date.now() + PREMIUM_REWARD_DAYS * 24 * 60 * 60 * 1000);

  await Promise.all([
    User.findByIdAndUpdate(referrer._id, {
      $inc: { referral_count: 1 },
      $max: { premium_until: premiumUntil },
    }),
    User.findByIdAndUpdate(newUserId, {
      referred_by: referralCode,
      premium_until: premiumUntil,
    }),
  ]);

  return true;
}

/** Get referral stats for admin (Task 30.6) */
export async function getReferralStats(): Promise<{
  totalReferrals: number;
  topReferrers: any[];
}> {
  const totalReferrals = await Referral.countDocuments();
  const topReferrers = await Referral.aggregate([
    { $group: { _id: '$referrer_id', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { email: '$user.email', count: 1 } },
  ]);
  return { totalReferrals, topReferrers };
}
