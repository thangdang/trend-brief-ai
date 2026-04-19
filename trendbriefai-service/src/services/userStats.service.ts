import { Interaction } from '../models/Interaction';
import { Bookmark } from '../models/Bookmark';
import { UserActivity } from '../models/UserActivity';

export interface UserStatsResponse {
  totalArticlesRead: number;
  totalBookmarks: number;
  daysActive: number;
}

export async function getUserStats(userId: string): Promise<UserStatsResponse> {
  const [totalArticlesRead, totalBookmarks, daysActive] = await Promise.all([
    Interaction.countDocuments({ user_id: userId, action: 'view' }),
    Bookmark.countDocuments({ user_id: userId }),
    UserActivity.countDocuments({ user_id: userId }),
  ]);

  return { totalArticlesRead, totalBookmarks, daysActive };
}
