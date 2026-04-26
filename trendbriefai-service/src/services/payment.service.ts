import crypto from 'crypto';
import axios from 'axios';
import { Payment } from '../models/Payment';
import { Subscription } from '../models/Subscription';
import { User } from '../models/User';
import { config } from '../config';

const PLANS: Record<string, { price: number; durationDays: number; label: string }> = {
  pro_monthly: { price: 49000, durationDays: 30, label: 'Pro Monthly' },
  pro_yearly: { price: 399000, durationDays: 365, label: 'Pro Yearly' },
};

export function getPlans() {
  return Object.entries(PLANS).map(([key, val]) => ({ id: key, ...val, currency: 'VND' }));
}

function generateOrderId(): string {
  return `TB-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

export async function createMoMoPayment(userId: string, plan: string) {
  const planInfo = PLANS[plan];
  if (!planInfo) throw new Error('Invalid plan');

  const orderId = generateOrderId();
  const requestId = orderId;
  const orderInfo = `TrendBrief AI - ${planInfo.label}`;
  const amount = planInfo.price;

  const rawSignature = `accessKey=${config.payment.momo.accessKey}&amount=${amount}&extraData=&ipnUrl=${config.payment.momo.ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${config.payment.momo.partnerCode}&redirectUrl=${config.payment.momo.redirectUrl}&requestId=${requestId}&requestType=payWithMethod`;
  const signature = crypto.createHmac('sha256', config.payment.momo.secretKey).update(rawSignature).digest('hex');

  const body = {
    partnerCode: config.payment.momo.partnerCode,
    requestId, amount, orderId, orderInfo,
    redirectUrl: config.payment.momo.redirectUrl,
    ipnUrl: config.payment.momo.ipnUrl,
    requestType: 'payWithMethod',
    extraData: '', lang: 'vi', signature,
  };

  const res = await axios.post(`${config.payment.momo.endpoint}/create`, body);

  await Payment.create({ user_id: userId, order_id: orderId, amount, method: 'momo', plan, status: 'pending' });
  return { payUrl: res.data.payUrl, orderId };
}

export async function createVNPayPayment(userId: string, plan: string, clientIp: string) {
  const planInfo = PLANS[plan];
  if (!planInfo) throw new Error('Invalid plan');

  const orderId = generateOrderId();
  const amount = planInfo.price * 100;
  const createDate = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

  const params: Record<string, string> = {
    vnp_Version: '2.1.0', vnp_Command: 'pay',
    vnp_TmnCode: config.payment.vnpay.tmnCode,
    vnp_Amount: amount.toString(), vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: `TrendBrief AI - ${planInfo.label}`,
    vnp_OrderType: 'other', vnp_Locale: 'vn',
    vnp_ReturnUrl: config.payment.vnpay.returnUrl,
    vnp_IpAddr: clientIp,
    vnp_CreateDate: createDate,
  };

  const sortedKeys = Object.keys(params).sort();
  const signData = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  const signed = crypto.createHmac('sha512', config.payment.vnpay.hashSecret).update(Buffer.from(signData, 'utf-8')).digest('hex');
  params.vnp_SecureHash = signed;

  const queryString = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const payUrl = `${config.payment.vnpay.url}?${queryString}`;

  await Payment.create({ user_id: userId, order_id: orderId, amount: planInfo.price, method: 'vnpay', plan, status: 'pending' });
  return { payUrl, orderId };
}

export async function handleMoMoWebhook(body: any): Promise<boolean> {
  const { orderId, resultCode, transId } = body;
  const payment = await Payment.findOne({ order_id: orderId });
  if (!payment) return false;

  if (resultCode === 0) {
    payment.status = 'completed';
    payment.provider_transaction_id = transId?.toString();
    await payment.save();
    await activateSubscription(payment.user_id.toString(), payment.plan, payment.method as any);
    return true;
  }
  payment.status = 'failed';
  await payment.save();
  return false;
}

export async function handleVNPayReturn(query: Record<string, string>): Promise<boolean> {
  const secureHash = query.vnp_SecureHash;
  const params = { ...query };
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const sortedKeys = Object.keys(params).sort();
  const signData = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  const signed = crypto.createHmac('sha512', config.payment.vnpay.hashSecret).update(Buffer.from(signData, 'utf-8')).digest('hex');
  if (signed !== secureHash) return false;

  const orderId = query.vnp_TxnRef;
  const payment = await Payment.findOne({ order_id: orderId });
  if (!payment) return false;

  if (query.vnp_ResponseCode === '00') {
    payment.status = 'completed';
    payment.provider_transaction_id = query.vnp_TransactionNo;
    await payment.save();
    await activateSubscription(payment.user_id.toString(), payment.plan, payment.method as any);
    return true;
  }
  payment.status = 'failed';
  await payment.save();
  return false;
}

// Create Stripe Checkout Session
export async function createStripeCheckout(userId: string, plan: string, userEmail: string) {
  const planInfo = PLANS[plan];
  if (!planInfo) throw new Error('Invalid plan');
  if (!config.payment.stripe.secretKey) throw new Error('Stripe not configured');

  const Stripe = require('stripe');
  const stripe = new Stripe(config.payment.stripe.secretKey);

  const orderId = generateOrderId();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: userEmail,
    line_items: [{
      price_data: {
        currency: 'vnd',
        product_data: { name: `TrendBrief AI - ${planInfo.label}` },
        unit_amount: planInfo.price,
      },
      quantity: 1,
    }],
    metadata: { orderId, userId, plan },
    success_url: `${config.payment.stripe.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: config.payment.stripe.cancelUrl,
  });

  await Payment.create({
    user_id: userId, order_id: orderId, amount: planInfo.price,
    method: 'stripe', plan, status: 'pending',
    metadata: { stripe_session_id: session.id },
  });

  return { sessionId: session.id, url: session.url, orderId };
}

// Handle Stripe webhook
export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<boolean> {
  if (!config.payment.stripe.secretKey || !config.payment.stripe.webhookSecret) return false;

  const Stripe = require('stripe');
  const stripe = new Stripe(config.payment.stripe.secretKey);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.payment.stripe.webhookSecret);
  } catch { return false; }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { orderId, userId, plan } = session.metadata;
    const payment = await Payment.findOne({ order_id: orderId });
    if (!payment) return false;

    payment.status = 'completed';
    payment.provider_transaction_id = session.payment_intent;
    await payment.save();
    await activateSubscription(userId, plan, 'stripe');
    return true;
  }
  return false;
}

export async function verifyMobileReceipt(userId: string, plan: string, method: 'apple_iap' | 'google_play', receipt: string) {
  const orderId = generateOrderId();
  const planInfo = PLANS[plan];
  if (!planInfo) throw new Error('Invalid plan');

  await Payment.create({
    user_id: userId, order_id: orderId, amount: planInfo.price,
    method, plan, status: 'completed',
    provider_transaction_id: receipt.slice(0, 64),
    metadata: { receipt_preview: receipt.slice(0, 100) },
  });

  await activateSubscription(userId, plan, method);
  return { orderId, status: 'completed' };
}

async function activateSubscription(userId: string, plan: string, paymentMethod: string) {
  const planInfo = PLANS[plan];
  if (!planInfo) return;

  await Subscription.updateMany({ user_id: userId, status: 'active' }, { status: 'expired' });

  const sub = await Subscription.create({
    user_id: userId, plan, price: planInfo.price,
    payment_method: paymentMethod, status: 'active',
    starts_at: new Date(),
    expires_at: new Date(Date.now() + planInfo.durationDays * 24 * 60 * 60 * 1000),
  });

  await User.findByIdAndUpdate(userId, { premium_until: sub.expires_at });
  return sub;
}

export async function getActiveSubscription(userId: string) {
  return Subscription.findOne({
    user_id: userId,
    status: { $in: ['active', 'trial'] },
    expires_at: { $gt: new Date() },
  }).lean();
}

export async function cancelSubscription(userId: string) {
  return Subscription.findOneAndUpdate(
    { user_id: userId, status: 'active' },
    { status: 'cancelled', cancelled_at: new Date() },
    { new: true }
  );
}
