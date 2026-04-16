import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { config } from '../config';
import { AuthTokens } from '../types/api.types';

const BCRYPT_COST_FACTOR = 12;

function generateTokens(userId: string, email: string): AuthTokens {
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

export async function register(
  email: string,
  password: string
): Promise<AuthTokens> {
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

  const user = await User.create({
    email: email.toLowerCase().trim(),
    password_hash: passwordHash,
    interests: [],
  });

  return generateTokens(user.id, user.email);
}

export async function login(
  email: string,
  password: string
): Promise<AuthTokens> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  return generateTokens(user.id, user.email);
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  try {
    const payload = jwt.verify(refreshToken, config.jwtSecret) as {
      id: string;
      email: string;
    };

    const user = await User.findById(payload.id);
    if (!user) {
      throw new Error('User not found');
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtAccessExpiry }
    );

    return { accessToken };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw err;
  }
}
