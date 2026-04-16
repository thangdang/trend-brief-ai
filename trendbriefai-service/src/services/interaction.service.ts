import mongoose from 'mongoose';
import { Interaction, IInteraction } from '../models/Interaction';
import { InteractionAction } from '../types/api.types';
import { recordArticleView } from './userActivity.service';

export async function trackInteraction(
  userId: string,
  articleId: string,
  action: InteractionAction
): Promise<IInteraction> {
  const interaction = await Interaction.create({
    user_id: new mongoose.Types.ObjectId(userId),
    article_id: new mongoose.Types.ObjectId(articleId),
    action,
  });

  // Track article view count for DAU/session metrics
  if (action === 'view') {
    recordArticleView(userId).catch(() => {});
  }

  return interaction;
}
