import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { bookmarkSchema } from '../types/schemas';
import { addBookmark, removeBookmark, getBookmarks } from '../services/bookmark.service';

const router = Router();

// POST /api/bookmarks
router.post('/', authMiddleware, validate(bookmarkSchema), async (req: Request, res: Response) => {
  try {
    const { articleId } = req.body;
    const { bookmark, created } = await addBookmark(req.user!.id, articleId);
    res.status(created ? 201 : 200).json(bookmark);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add bookmark' });
  }
});

// DELETE /api/bookmarks/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const deleted = await removeBookmark(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: 'Bookmark not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove bookmark' });
  }
});

// GET /api/bookmarks
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await getBookmarks(req.user!.id, page, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

export default router;
