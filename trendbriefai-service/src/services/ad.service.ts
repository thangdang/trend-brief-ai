import { Ad, IAd } from '../models/Ad';
import { Topic } from '../types/api.types';

export async function getActiveAds(topic?: Topic): Promise<IAd[]> {
  const now = new Date();
  const filter: Record<string, unknown> = {
    status: 'active',
    end_date: { $gte: now },
    $expr: { $lt: ['$spent_cents', '$budget_cents'] },
  };
  if (topic) {
    filter.topic = topic;
  }
  return Ad.find(filter).lean();
}

export async function trackAdImpression(adId: string): Promise<void> {
  await Ad.findByIdAndUpdate(adId, { $inc: { impressions: 1 } });
}

export async function trackAdClick(adId: string): Promise<void> {
  await Ad.findByIdAndUpdate(adId, { $inc: { clicks: 1 } });
}

export async function createAd(data: Partial<IAd>): Promise<IAd> {
  const ad = new Ad(data);
  return ad.save();
}

export async function updateAd(id: string, data: Partial<IAd>): Promise<IAd> {
  const ad = await Ad.findByIdAndUpdate(id, data, { new: true });
  if (!ad) throw new Error('Ad not found');
  return ad;
}

export async function listAds(): Promise<IAd[]> {
  return Ad.find().sort({ created_at: -1 }).lean();
}
