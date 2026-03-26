import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';

const TWO_FACTOR_SETUP_TTL_SECONDS = 10 * 60;

export async function generateSecret(
  userId: string,
  email: string
): Promise<{ secret: string; qrCodeDataUrl: string }> {
  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(email, 'Axios Pay', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

  await redis.set(`2fa-setup:${userId}`, secret, 'EX', TWO_FACTOR_SETUP_TTL_SECONDS);
  return { secret, qrCodeDataUrl };
}

export async function verifyAndEnable(userId: string, token: string): Promise<void> {
  const secret = await redis.get(`2fa-setup:${userId}`);
  if (!secret) throw new Error('TWO_FACTOR_SETUP_EXPIRED');

  const isValid = authenticator.verify({ token, secret });
  if (!isValid) throw new Error('TWO_FACTOR_INVALID');

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
      isTwoFactorEnabled: true,
    },
  });

  await redis.del(`2fa-setup:${userId}`);
}

export async function verifyToken(userId: string, token: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isTwoFactorEnabled: true, twoFactorSecret: true },
  });

  if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
    throw new Error('TWO_FACTOR_NOT_ENABLED');
  }

  return authenticator.verify({ token, secret: user.twoFactorSecret });
}

export async function disable(userId: string, token: string): Promise<void> {
  const valid = await verifyToken(userId, token);
  if (!valid) throw new Error('TWO_FACTOR_INVALID');

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: null,
      isTwoFactorEnabled: false,
    },
  });
}
