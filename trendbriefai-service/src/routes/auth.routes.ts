import { Router, Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, refreshSchema } from '../types/schemas';

const router = Router();

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const tokens = await authService.register(email, password);
    res.status(201).json(tokens);
  } catch (err: any) {
    if (err.message === 'Email already registered') {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const tokens = await authService.login(email, password);
    res.json(tokens);
  } catch (err: any) {
    if (err.message === 'Invalid email or password') {
      res.status(401).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'Refresh token expired' || err.message === 'Invalid refresh token') {
      res.status(401).json({ error: err.message });
      return;
    }
    if (err.message === 'User not found') {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

export default router;
