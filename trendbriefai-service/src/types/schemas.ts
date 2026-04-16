import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const bookmarkSchema = z.object({
  articleId: z.string().min(1),
});

export const interactionSchema = z.object({
  articleId: z.string().min(1),
  action: z.enum(['view', 'click_original', 'share', 'bookmark']),
});

export const updateInterestsSchema = z.object({
  interests: z.array(z.enum(['ai', 'finance', 'lifestyle', 'drama'])),
});

export const searchSchema = z.object({
  q: z.string().min(1),
});

const topicEnum = z.enum(['ai', 'finance', 'lifestyle', 'drama']);

export const createAdSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  image_url: z.string().url().optional(),
  target_url: z.string().url(),
  advertiser: z.string().min(1),
  topic: topicEnum,
  status: z.enum(['active', 'paused', 'expired']).optional(),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  budget_cents: z.number().int().positive(),
});

export const updateAdSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  image_url: z.string().url().optional(),
  target_url: z.string().url().optional(),
  advertiser: z.string().min(1).optional(),
  topic: topicEnum.optional(),
  status: z.enum(['active', 'paused', 'expired']).optional(),
  start_date: z.string().min(1).optional(),
  end_date: z.string().min(1).optional(),
  budget_cents: z.number().int().positive().optional(),
});

export const createAffiliateLinkSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  topic: topicEnum,
  commission: z.string().min(1),
  provider: z.string().min(1),
  is_active: z.boolean().optional(),
});
