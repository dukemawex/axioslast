import crypto from 'crypto';
import { redis } from '../config/redis';

export function generateOTP(): string {
  const bytes = crypto.randomBytes(3);
  const num = parseInt(bytes.toString('hex'), 16) % 1000000;
  return num.toString().padStart(6, '0');
}

export async function storeOTP(key: string, otp: string, ttlSeconds: number): Promise<void> {
  await redis.set(`otp:${key}`, otp, 'EX', ttlSeconds);
}

export async function verifyOTP(key: string, otp: string): Promise<void> {
  const stored = await redis.get(`otp:${key}`);
  if (!stored) {
    throw new Error('OTP_EXPIRED');
  }
  if (stored !== otp) {
    throw new Error('OTP_INVALID');
  }
  await redis.del(`otp:${key}`);
}
