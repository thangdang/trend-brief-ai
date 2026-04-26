import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as paymentService from '../services/payment.service';

const router = Router();

// GET /api/payment/plans
router.get('/plans', (_req: Request, res: Response) => {
  res.json({ plans: paymentService.getPlans() });
});

// POST /api/payment/create
router.post('/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { plan, method } = req.body;
    if (!plan || !method) {
      res.status(400).json({ error: 'plan and method required' });
      return;
    }

    if (method === 'momo') {
      const result = await paymentService.createMoMoPayment(req.user!.id, plan);
      res.json(result);
    } else if (method === 'vnpay') {
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const result = await paymentService.createVNPayPayment(req.user!.id, plan, clientIp);
      res.json(result);
    } else if (method === 'stripe') {
      const result = await paymentService.createStripeCheckout(req.user!.id, plan, req.user!.email);
      res.json(result);
    } else {
      res.status(400).json({ error: 'Unsupported payment method' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Payment creation failed' });
  }
});

// POST /api/payment/verify-mobile
router.post('/verify-mobile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { plan, method, receipt } = req.body;
    if (!plan || !method || !receipt) {
      res.status(400).json({ error: 'plan, method, and receipt required' });
      return;
    }
    if (method !== 'apple_iap' && method !== 'google_play') {
      res.status(400).json({ error: 'method must be apple_iap or google_play' });
      return;
    }

    const result = await paymentService.verifyMobileReceipt(req.user!.id, plan, method, receipt);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Receipt verification failed' });
  }
});

// POST /api/payment/webhook/momo
router.post('/webhook/momo', async (req: Request, res: Response) => {
  try {
    const success = await paymentService.handleMoMoWebhook(req.body);
    res.status(success ? 200 : 400).json({ success });
  } catch {
    res.status(500).json({ success: false });
  }
});

// POST /api/payment/webhook/vnpay
router.post('/webhook/vnpay', async (req: Request, res: Response) => {
  try {
    const success = await paymentService.handleVNPayReturn(req.query as Record<string, string>);
    res.status(success ? 200 : 400).json({ RspCode: success ? '00' : '99' });
  } catch {
    res.status(500).json({ RspCode: '99' });
  }
});

// POST /api/payment/webhook/stripe
router.post('/webhook/stripe', async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const rawBody = (req as any).rawBody || req.body;
    const success = await paymentService.handleStripeWebhook(rawBody, sig);
    res.status(success ? 200 : 400).json({ received: success });
  } catch {
    res.status(500).json({ received: false });
  }
});

// GET /api/payment/stripe/config
router.get('/stripe/config', (_req: Request, res: Response) => {
  const { config: appConfig } = require('../config');
  res.json({ publishableKey: appConfig.payment.stripe.publishableKey });
});

// GET /api/payment/subscription
router.get('/subscription', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sub = await paymentService.getActiveSubscription(req.user!.id);
    res.json({ subscription: sub, is_premium: !!sub });
  } catch {
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// POST /api/payment/cancel
router.post('/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sub = await paymentService.cancelSubscription(req.user!.id);
    if (!sub) {
      res.status(404).json({ error: 'No active subscription found' });
      return;
    }
    res.json({ subscription: sub });
  } catch {
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
