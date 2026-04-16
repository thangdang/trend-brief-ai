import { Analytics, IAnalytics } from '../models/Analytics';
import { Interaction } from '../models/Interaction';
import { Ad } from '../models/Ad';
import { AffiliateLinkModel } from '../models/AffiliateLink';
import { getDAU, getMAU, getRetentionD7, getAvgSessionsPerUser, getAvgArticlesPerUser } from './userActivity.service';

export async function getDailyAnalytics(startDate: string, endDate: string): Promise<IAnalytics[]> {
  return Analytics.find({
    date: { $gte: startDate, $lte: endDate },
  })
    .sort({ date: 1 })
    .lean();
}

export async function aggregateToday(): Promise<IAnalytics> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  const dateFilter = { created_at: { $gte: startOfDay, $lte: endOfDay } };

  // Aggregate interactions
  const interactionAgg = await Interaction.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        total_views: { $sum: { $cond: [{ $eq: ['$action', 'view'] }, 1, 0] } },
        total_clicks: { $sum: { $cond: [{ $eq: ['$action', 'click_original'] }, 1, 0] } },
        total_shares: { $sum: { $cond: [{ $eq: ['$action', 'share'] }, 1, 0] } },
        total_bookmarks: { $sum: { $cond: [{ $eq: ['$action', 'bookmark'] }, 1, 0] } },
        unique_users: { $addToSet: '$user_id' },
      },
    },
  ]);

  const stats = interactionAgg[0] || {
    total_views: 0,
    total_clicks: 0,
    total_shares: 0,
    total_bookmarks: 0,
    unique_users: [],
  };

  // Ad stats: sum today's impressions and clicks across all ads
  const adAgg = await Ad.aggregate([
    {
      $group: {
        _id: null,
        ad_impressions: { $sum: '$impressions' },
        ad_clicks: { $sum: '$clicks' },
      },
    },
  ]);
  const adStats = adAgg[0] || { ad_impressions: 0, ad_clicks: 0 };

  // Affiliate clicks + impressions
  const affiliateAgg = await AffiliateLinkModel.aggregate([
    {
      $group: {
        _id: null,
        affiliate_clicks: { $sum: '$clicks' },
        affiliate_impressions: { $sum: '$impressions' },
      },
    },
  ]);
  const affiliateStats = affiliateAgg[0] || { affiliate_clicks: 0, affiliate_impressions: 0 };

  // DAU from UserActivity
  const dauCount = await getDAU(dateStr);

  const analyticsData = {
    date: dateStr,
    total_views: stats.total_views,
    unique_users: dauCount || (Array.isArray(stats.unique_users) ? stats.unique_users.length : 0),
    total_clicks: stats.total_clicks,
    total_shares: stats.total_shares,
    total_bookmarks: stats.total_bookmarks,
    ad_impressions: adStats.ad_impressions,
    ad_clicks: adStats.ad_clicks,
    affiliate_clicks: affiliateStats.affiliate_clicks,
    affiliate_impressions: affiliateStats.affiliate_impressions,
  };

  const result = await Analytics.findOneAndUpdate(
    { date: dateStr },
    { $set: analyticsData },
    { upsert: true, new: true },
  );

  return result;
}
