/**
 * Image Proxy — resize + cache article images.
 * GET /api/img/:articleId → fetch → resize (max 800px) → cache → serve
 */

import { Router, Request, Response } from 'express';
import { Article } from '../models/Article';
import Redis from 'ioredis';
import { config } from '../config';

const router = Router();
const redis = new Redis(config.redisUrl);
const CACHE_TTL = 3600; // 1 hour
const MAX_WIDTH = 800;

router.get('/:articleId', async (req: Request, res: Response) => {
  const { articleId } = req.params;
  const cacheKey = `img:${articleId}`;

  try {
    // Check Redis cache
    const cached = await redis.getBuffer(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached);
      return;
    }

    // Fetch article to get image URL
    const article = await Article.findById(articleId).select('image_url').lean();
    if (!article || !(article as any).image_url) {
      res.status(404).json({ error: 'No image' });
      return;
    }

    const imageUrl = (article as any).image_url;

    // Download original image
    const axios = require('axios');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'User-Agent': 'TrendBriefAI/1.0' },
    });

    let buffer = Buffer.from(response.data);

    // Resize + convert to WebP using sharp (if available)
    try {
      const sharp = require('sharp');
      buffer = await sharp(buffer)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      // sharp not available — serve original
    }

    // Cache in Redis
    await redis.setex(cacheKey, CACHE_TTL, buffer);

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err: any) {
    res.status(502).json({ error: 'Image fetch failed' });
  }
});

export default router;
