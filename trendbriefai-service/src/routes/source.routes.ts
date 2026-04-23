import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { RssSource } from '../models/RssSource';
import axios from 'axios';
import { config } from '../config';

const router = Router();

// GET /api/sources — list all sources
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const sources = await RssSource.find().sort({ created_at: -1 }).lean();
    res.json(sources);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list sources' });
  }
});

// POST /api/sources — create source
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const source = new RssSource(req.body);
    await source.save();
    res.status(201).json(source);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create source' });
  }
});

// PUT /api/sources/:id — update source
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const source = await RssSource.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!source) { res.status(404).json({ error: 'Source not found' }); return; }
    res.json(source);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update source' });
  }
});

// DELETE /api/sources/:id — delete source
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await RssSource.findByIdAndDelete(req.params.id);
    res.json({ message: 'Source deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete source' });
  }
});

// POST /api/sources/:id/crawl — trigger manual crawl
router.post('/:id/crawl', authMiddleware, async (req: Request, res: Response) => {
  try {
    const source = await RssSource.findById(req.params.id).lean();
    if (!source) { res.status(404).json({ error: 'Source not found' }); return; }
    // Trigger crawl via AI engine
    await axios.post(`${config.aiServiceUrl}/crawl`, { source_url: source.url, source_name: source.name });
    await RssSource.findByIdAndUpdate(req.params.id, { last_crawled_at: new Date() });
    res.json({ message: 'Crawl triggered' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger crawl' });
  }
});

export default router;
