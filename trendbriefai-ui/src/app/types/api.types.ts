export type Topic = 'ai' | 'finance' | 'lifestyle' | 'drama';

export type InteractionAction = 'view' | 'click_original' | 'share' | 'bookmark';

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
}

export interface FeedResponse {
  items: FeedItem[];
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
