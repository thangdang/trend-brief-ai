import { AffiliateLinkModel, IAffiliateLink } from '../models/AffiliateLink';
import { Topic } from '../types/api.types';

export async function getAffiliateLinks(topic: Topic): Promise<IAffiliateLink[]> {
  return AffiliateLinkModel.find({ topic, is_active: true }).lean();
}

export async function trackAffiliateClick(linkId: string): Promise<void> {
  await AffiliateLinkModel.findByIdAndUpdate(linkId, { $inc: { clicks: 1 } });
}

export async function trackAffiliateImpressions(linkIds: string[]): Promise<void> {
  if (linkIds.length === 0) return;
  await AffiliateLinkModel.updateMany(
    { _id: { $in: linkIds } },
    { $inc: { impressions: 1 } },
  );
}

export async function createAffiliateLink(data: Partial<IAffiliateLink>): Promise<IAffiliateLink> {
  const link = new AffiliateLinkModel(data);
  return link.save();
}

export async function listAffiliateLinks(): Promise<IAffiliateLink[]> {
  return AffiliateLinkModel.find().sort({ created_at: -1 }).lean();
}
