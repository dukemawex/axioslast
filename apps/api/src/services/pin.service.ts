import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { env } from '../config/env';

const PIN_TOKEN_TTL_SECONDS = 5 * 60;

function ensurePinFormat(pin: string): void {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN_INVALID');
  }
}

export async function setPin(userId: string, pin: string): Promise<void> {
  ensurePinFormat(pin);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { transactionPin: true, isPinSet: true },
  });

  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.isPinSet || user.transactionPin) throw new Error('PIN_ALREADY_SET');

  const hashedPin = await bcrypt.hash(pin, 10);
  await prisma.user.update({
    where: { id: userId },
    data: {
      transactionPin: hashedPin,
      isPinSet: true,
    },
  });
}

export async function verifyPin(userId: string, pin: string): Promise<void> {
  ensurePinFormat(pin);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { transactionPin: true, isPinSet: true },
  });

  if (!user) throw new Error('USER_NOT_FOUND');
  if (!user.isPinSet || !user.transactionPin) throw new Error('PIN_NOT_SET');

  const isValid = await bcrypt.compare(pin, user.transactionPin);
  if (!isValid) throw new Error('PIN_INVALID');
}

export async function changePin(userId: string, currentPin: string, newPin: string): Promise<void> {
  ensurePinFormat(newPin);
  await verifyPin(userId, currentPin);

  const hashedPin = await bcrypt.hash(newPin, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { transactionPin: hashedPin, isPinSet: true },
  });
}

export async function createPinToken(userId: string): Promise<string> {
  const token = jwt.sign(
    { sub: userId, type: 'pin' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '5m' } as jwt.SignOptions
  );
  await redis.set(`pin-token:${token}`, userId, 'EX', PIN_TOKEN_TTL_SECONDS);
  return token;
}

export async function verifyPinToken(userId: string, token?: string): Promise<void> {
  if (!token) throw new Error('PIN_TOKEN_REQUIRED');

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; type: string };
    if (payload.type !== 'pin' || payload.sub !== userId) throw new Error('PIN_TOKEN_EXPIRED');
  } catch {
    throw new Error('PIN_TOKEN_EXPIRED');
  }

  const storedUserId = await redis.get(`pin-token:${token}`);
  if (!storedUserId || storedUserId !== userId) throw new Error('PIN_TOKEN_EXPIRED');
}
