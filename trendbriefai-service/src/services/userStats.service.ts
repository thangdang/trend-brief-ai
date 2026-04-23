import { Interaction } from '../models/Interaction';
import { Bookmark } from '../models/Bookmark';
import { UserActivity } from '../models/UserActivity';
import { User } from '../models/User';

export interface UserStatsResponse {
  totalArticlesRead: number;
  totalBookmarks: number;
  daysActive: number;
  streakCount: number;
}

export async function getUserStats(userId: string): Promise<UserStatsResponse> {
  const [totalArticlesRead, totalBookmarks, daysActive, user] = await Promise.all([
    Interaction.countDocuments({ user_id: userId, action: 'view' }),
    Bookmark.countDocuments({ user_id: userId }),
    UserActivity.countDocuments({ user_id: userId }),
    User.findById(userId).select('streak_count').lean(),
  ]);

  return {
    totalArticlesRead,
    totalBookmarks,
    daysActive,
    streakCount: (user as any)?.streak_count || 0,
  };
}
