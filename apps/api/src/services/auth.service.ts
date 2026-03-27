import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { generateOTP, storeOTP, verifyOTP } from './otp.service';
import { sendEmailOTP, sendWelcomeEmail, sendPasswordResetOTP, sendLoginNotificationEmail } from './email.service';
import * as twoFactorService from './twoFactor.service';

const NATIONALITY_CURRENCY_MAP: Record<string, string> = {
  NG: 'NGN',
  UG: 'UGX',
  KE: 'KES',
  GH: 'GHS',
  ZA: 'ZAR',
};

const OTP_TTL = 600; // 10 minutes
const RESET_OTP_TTL = 900; // 15 minutes

const DUMMY_HASH = '$2b$12$dummyhashfortimingequalitywhenuserdoesnotexist00000000000';

export interface RegisterInput {
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  nationality: string;
}

export async function register(input: RegisterInput): Promise<{ userId: string; message: string }> {
  const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingEmail) throw new Error('EMAIL_EXISTS');

  const existingPhone = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (existingPhone) throw new Error('PHONE_EXISTS');

  const passwordHash = await bcrypt.hash(input.password, 12);

  const nativeCurrency = NATIONALITY_CURRENCY_MAP[input.nationality.toUpperCase()];

  const user = await prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      nationality: input.nationality.toUpperCase(),
      wallets: {
        create: [
          { currency: 'NGN', balance: 0 },
          ...(nativeCurrency && nativeCurrency !== 'NGN'
            ? [{ currency: nativeCurrency, balance: 0 }]
            : []),
        ],
      },
    },
  });

  const emailOTP = generateOTP();
  const magicToken = crypto.randomBytes(32).toString('hex');

  await storeOTP(`email:${user.id}`, emailOTP, OTP_TTL);
  await redis.set(`magic:${user.id}`, magicToken, 'EX', OTP_TTL);

  await sendEmailOTP(user.email, user.firstName, emailOTP, magicToken, user.id);

  return { userId: user.id, message: 'Registration successful' };
}

export async function verifyEmail(userId: string, otp: string): Promise<{ verified: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.isEmailVerified) throw new Error('EMAIL_ALREADY_VERIFIED');

  await verifyOTP(`email:${userId}`, otp);

  await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true, isPhoneVerified: true },
  });

  await redis.del(`magic:${userId}`);
  await sendWelcomeEmail(user.email, user.firstName);

  return { verified: true };
}

export async function verifyEmailLink(
  userId: string,
  token: string
): Promise<{ verified: boolean; userId: string; alreadyVerified?: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  if (user.isEmailVerified) {
    return { verified: true, userId, alreadyVerified: true };
  }

  const storedToken = await redis.get(`magic:${userId}`);
  const storedBuffer = storedToken ? Buffer.from(storedToken, 'utf8') : null;
  const providedBuffer = Buffer.from(token, 'utf8');
  const isValidToken = Boolean(
    storedBuffer &&
      storedBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(storedBuffer, providedBuffer)
  );
  if (!isValidToken) {
    throw new Error('INVALID_TOKEN');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true, isPhoneVerified: true },
  });

  await redis.del(`magic:${userId}`);
  await redis.del(`otp:email:${userId}`);
  await sendWelcomeEmail(user.email, user.firstName);

  return { verified: true, userId };
}

export async function verifyPhone(userId: string, otp: string): Promise<{ verified: boolean }> {
  await verifyOTP(`phone:${userId}`, otp);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  await prisma.user.update({
    where: { id: userId },
    data: { isPhoneVerified: true },
  });

  await sendWelcomeEmail(user.email, user.firstName);

  return { verified: true };
}

export interface LoginInput {
  identifier: string; // email or phone
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export async function login(input: LoginInput): Promise<{
  accessToken?: string;
  refreshToken?: string;
  user?: object;
  requires2FA?: boolean;
  tempToken?: string;
}> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.identifier }, { phone: input.identifier }],
    },
    include: { wallets: true },
  });

  if (!user) {
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw new Error('INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  if (!user.isEmailVerified) throw new Error('EMAIL_NOT_VERIFIED');

  if (user.isFrozen) throw new Error('ACCOUNT_FROZEN');

  if (user.isTwoFactorEnabled) {
    const tempToken = nanoid(48);
    await redis.set(`2fa-login:${tempToken}`, user.id, 'EX', 300);
    return { requires2FA: true, tempToken };
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = nanoid(64);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRY_DAYS);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      expiresAt,
    },
  });

  const { passwordHash: _, transactionPin: __, twoFactorSecret: ___, ...userWithoutHash } = user;

  await sendLoginNotificationEmail(
    user.email,
    user.firstName,
    input.ipAddress,
    input.userAgent,
    new Date()
  );

  return { accessToken, refreshToken, user: userWithoutHash };
}

export async function verify2FALogin(
  tempToken: string,
  token: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ accessToken: string; refreshToken: string; user: object }> {
  const userId = await redis.get(`2fa-login:${tempToken}`);
  if (!userId) throw new Error('TWO_FACTOR_TEMP_TOKEN_INVALID');

  const isValid = await twoFactorService.verifyToken(userId, token);
  if (!isValid) throw new Error('TWO_FACTOR_INVALID');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallets: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');

  const accessToken = signAccessToken(user.id);
  const refreshToken = nanoid(64);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRY_DAYS);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  await redis.del(`2fa-login:${tempToken}`);

  const { passwordHash: _, transactionPin: __, twoFactorSecret: ___, ...userWithoutHash } = user;

  await sendLoginNotificationEmail(
    user.email,
    user.firstName,
    ipAddress,
    userAgent,
    new Date()
  );

  return { accessToken, refreshToken, user: userWithoutHash };
}

export async function refresh(token: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const session = await prisma.session.findUnique({
    where: { refreshToken: token },
  });

  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    throw new Error('SESSION_EXPIRED');
  }

  const newRefreshToken = nanoid(64);
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + env.JWT_REFRESH_EXPIRY_DAYS);

  await prisma.session.update({
    where: { id: session.id },
    data: { refreshToken: newRefreshToken, expiresAt: newExpiresAt },
  });

  const accessToken = signAccessToken(session.userId);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { refreshToken: token } });
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return; // Don't reveal if user exists

  const otp = generateOTP();
  await storeOTP(`reset:${user.id}`, otp, RESET_OTP_TTL);
  await redis.set(`reset:email:${email}`, user.id, 'EX', RESET_OTP_TTL);

  await sendPasswordResetOTP(user.email, user.firstName, otp);
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
  const userId = await redis.get(`reset:email:${email}`);
  if (!userId) throw new Error('OTP_EXPIRED');

  await verifyOTP(`reset:${userId}`, otp);

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);

  await redis.del(`reset:email:${email}`);
}

export async function resendOTP(input: { userId?: string; email?: string }): Promise<{ userId: string }> {
  const user = input.userId
    ? await prisma.user.findUnique({ where: { id: input.userId } })
    : input.email
      ? await prisma.user.findUnique({ where: { email: input.email } })
      : null;

  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.isEmailVerified) throw new Error('EMAIL_ALREADY_VERIFIED');

  const otp = generateOTP();
  const magicToken = crypto.randomBytes(32).toString('hex');
  await storeOTP(`email:${user.id}`, otp, OTP_TTL);
  await redis.set(`magic:${user.id}`, magicToken, 'EX', OTP_TTL);
  await sendEmailOTP(user.email, user.firstName, otp, magicToken, user.id);

  return { userId: user.id };
}

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  } as jwt.SignOptions);
}
