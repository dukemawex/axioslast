import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/prisma';
import { generateOTP, storeOTP, verifyOTP } from '../services/otp.service';
import { sendEmailOTP } from '../services/email.service';

const updateMeSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
});

const updateLimitSchema = z.object({
  dailySwapLimit: z.number().positive(),
});

const freezeSchema = z.object({
  pin: z.string().length(4),
});

const unfreezeSchema = z.object({
  otp: z.string().length(6),
});

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        nationality: true,
        kycStatus: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        updatedAt: true,
        isPinSet: true,
        isTwoFactorEnabled: true,
        isFrozen: true,
        dailySwapLimit: true,
        dailySwapUsed: true,
        dailyLimitResetAt: true,
        wallets: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
      return;
    }

    res.json({
      ...user,
      transactionPin: undefined,
      twoFactorSecret: undefined,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateMeSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        nationality: true,
        kycStatus: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function updateDailyLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = updateLimitSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { kycStatus: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const maxLimitByKyc: Record<string, number> = {
      PENDING: 50000,
      SUBMITTED: 50000,
      APPROVED: 5000000,
      REJECTED: 50000,
    };
    const maxAllowed = maxLimitByKyc[user.kycStatus] ?? 50000;
    if (data.dailySwapLimit > maxAllowed) throw new Error('LIMIT_ABOVE_KYC_MAX');

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { dailySwapLimit: data.dailySwapLimit },
      select: { dailySwapLimit: true, dailySwapUsed: true, dailyLimitResetAt: true },
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function freezeAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = freezeSchema.parse(req.body);
    const { verifyPin } = await import('../services/pin.service');
    await verifyPin(req.userId!, data.pin);

    await prisma.user.update({
      where: { id: req.userId },
      data: { isFrozen: true },
    });

    await prisma.session.deleteMany({ where: { userId: req.userId } });
    res.json({ message: 'Account frozen successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function unfreezeAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = unfreezeSchema.parse(req.body);
    await verifyOTP(`unfreeze:${req.userId!}`, data.otp);

    await prisma.user.update({
      where: { id: req.userId },
      data: { isFrozen: false },
    });

    res.json({ message: 'Account unfrozen successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function requestUnfreezeOtp(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true, firstName: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const otp = generateOTP();
    await storeOTP(`unfreeze:${req.userId!}`, otp, 600);
    await sendEmailOTP(user.email, user.firstName, otp);

    res.json({ message: 'Unfreeze OTP sent to your email' });
  } catch (err) {
    next(err);
  }
}
