import { Topic, ITopic } from '../models/Topic';

export async function getActiveTopics(): Promise<ITopic[]> {
  return Topic.find({ is_active: true }).sort({ order: 1 }).lean();
}
