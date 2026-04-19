export type Topic = 'ai' | 'finance' | 'lifestyle' | 'drama' | 'career' | 'insight' | 'technology' | 'health' | 'entertainment';

export type InteractionAction = 'view' | 'click_original' | 'share' | 'bookmark';

export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'failed' | 'fallback';

export type AdStatus = 'active' | 'paused' | 'expired';

export interface AdItem {
  id: string;
  type: 'native_ad';
  title: string;
  description: string;
  imageUrl?: string;
  targetUrl: string;
  advertiser: string;
  topic: Topic;
  isAd: true;
}

export interface AffiliateLink {
  id: string;
  title: string;
  url: string;
  topic: Topic;
  commission: string;
  provider: string;
  isActive: boolean;
}

export interface DailyAnalytics {
  date: string;
  totalViews: number;
  uniqueUsers: number;
  totalClicks: number;
  totalShares: number;
  totalBookmarks: number;
  adImpressions: number;
  adClicks: number;
  affiliateClicks: number;
}

export interface FeedItem {
  id: string;
  titleOriginal: string;
  titleAi: string;
  summaryBullets: string[];
  reason: string;
  url: string;
  topic: Topic;
  source: string;
  publishedAt: string;
  isBookmarked: boolean;
  createdAt: string;
  readingTimeSec: number;
  isSponsored: boolean;
  affiliateLinks?: AffiliateLink[];
  thumbnailUrl?: string;
  isTrending: boolean;
}

export type FeedEntry = FeedItem | AdItem;

export interface FeedResponse {
  items: FeedEntry[];
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  interests: Topic[];
  createdAt: string;
}
