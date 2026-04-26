import { Router, Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { applyReferral } from '../services/referral.service';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, refreshSchema } from '../types/schemas';
import { verifyGoogleToken, verifyAppleToken, findOrCreateSSOUser, generateTokens } from '../services/sso.service';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 */
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, referralCode } = req.body;
    const tokens = await authService.register(email, password);

    if (referralCode && typeof referralCode === 'string') {
      try {
        const jwt = await import('jsonwebtoken');
        const { config } = await import('../config');
        const payload = jwt.default.verify(tokens.accessToken, config.jwtSecret) as { id: string };
        await applyReferral(payload.id, referralCode);
      } catch (_) { /* referral failure shouldn't block registration */ }
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
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Login/Register with Google SSO
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: SSO login successful
 *       201:
 *         description: New user created via SSO
 *       401:
 *         description: Token verification failed
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ error: 'idToken required' });
      return;
    }

    const googleData = await verifyGoogleToken(idToken);
    const { user, isNew } = await findOrCreateSSOUser(
      'google', googleData.googleId, googleData.email, googleData.name, googleData.avatar
    );

    const tokens = generateTokens(user._id.toString(), user.email);
    res.status(isNew ? 201 : 200).json({ ...tokens, isNew });
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Google authentication failed' });
  }
});

/**
 * @swagger
 * /auth/apple:
 *   post:
 *     tags: [Auth]
 *     summary: Login/Register with Apple SSO
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *               user:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *     responses:
 *       200:
 *         description: SSO login successful
 *       201:
 *         description: New user created via SSO
 *       401:
 *         description: Token verification failed
 */
router.post('/apple', async (req: Request, res: Response) => {
  try {
    const { idToken, user: appleUser } = req.body;
    if (!idToken) {
      res.status(400).json({ error: 'idToken required' });
      return;
    }

    const appleData = await verifyAppleToken(idToken);
    const name = appleUser?.name || appleData.name || appleData.email.split('@')[0];
    const { user, isNew } = await findOrCreateSSOUser(
      'apple', appleData.appleId, appleData.email, name
    );

    const tokens = generateTokens(user._id.toString(), user.email);
    res.status(isNew ? 201 : 200).json({ ...tokens, isNew });
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Apple authentication failed' });
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
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
