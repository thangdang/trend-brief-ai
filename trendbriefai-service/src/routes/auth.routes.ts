import { Router, Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { applyReferral } from '../services/referral.service';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, refreshSchema } from '../types/schemas';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: Registration successful, returns tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Registration failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, referralCode } = req.body;
    const tokens = await authService.register(email, password);

    // Apply referral code if provided (Task 30.4)
    if (referralCode && typeof referralCode === 'string') {
      try {
        // Decode the JWT to get the new user's ID
        const jwt = await import('jsonwebtoken');
        const { config } = await import('../config');
        const payload = jwt.default.verify(tokens.accessToken, config.jwtSecret) as { id: string };
        await applyReferral(payload.id, referralCode);
      } catch (_) {
        // Referral failure shouldn't block registration
      }
    }

    res.status(201).json(tokens);
  } catch (err: any) {
    if (err.message === 'Email already registered') {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful, returns tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Login failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Token refresh failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
