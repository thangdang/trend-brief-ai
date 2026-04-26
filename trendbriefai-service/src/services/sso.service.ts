import jwt from 'jsonwebtoken';
import axios from 'axios';
import { User } from '../models/User';
import { config } from '../config';

export async function verifyGoogleToken(idToken: string): Promise<{ email: string; name: string; googleId: string; avatar?: string }> {
  const res = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  const { email, name, sub, picture } = res.data;

  if (!email) throw new Error('No email from Google token');

  return { email, name: name || email, googleId: sub, avatar: picture };
}

export async function verifyAppleToken(idToken: string): Promise<{ email: string; appleId: string; name?: string }> {
  const keysRes = await axios.get('https://appleid.apple.com/auth/keys');
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded) throw new Error('Invalid Apple token');

  const header = decoded.header as { kid: string; alg: string };
  const key = keysRes.data.keys.find((k: any) => k.kid === header.kid);
  if (!key) throw new Error('Apple key not found');

  const pubKey = buildApplePublicKey(key);
  const payload = jwt.verify(idToken, pubKey, { algorithms: [header.alg as jwt.Algorithm] }) as any;

  if (payload.iss !== 'https://appleid.apple.com') throw new Error('Invalid Apple issuer');

  return { email: payload.email, appleId: payload.sub, name: payload.email?.split('@')[0] };
}

function buildApplePublicKey(jwk: any): string {
  const { createPublicKey } = require('crypto');
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  return key.export({ type: 'spki', format: 'pem' }) as string;
}

export async function findOrCreateSSOUser(
  provider: 'google' | 'apple',
  providerId: string,
  email: string,
  name: string,
  avatar?: string
): Promise<{ user: any; isNew: boolean }> {
  const idField = provider === 'google' ? 'google_id' : 'apple_id';

  let user = await User.findOne({ [idField]: providerId });
  if (user) return { user, isNew: false };

  user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    user.set(idField, providerId);
    if (!user.avatar_url && avatar) user.avatar_url = avatar;
    if (user.provider === 'email') user.provider = provider;
    await user.save();
    return { user, isNew: false };
  }

  user = await User.create({
    email: email.toLowerCase(),
    name,
    provider,
    [idField]: providerId,
    avatar_url: avatar || null,
    password_hash: null,
  });

  return { user, isNew: true };
}

export function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { id: userId, email },
    config.jwtSecret,
    { expiresIn: config.jwtAccessExpiry }
  );
  const refreshToken = jwt.sign(
    { id: userId, email },
    config.jwtSecret,
    { expiresIn: config.jwtRefreshExpiry }
  );
  return { accessToken, refreshToken };
}
