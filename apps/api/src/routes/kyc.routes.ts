import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { getVerificationRequirements, verifyIdentity } from '../services/identity.service';

const router = Router();

const verifySchema = z.object({
  idNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
});

const memoryAttemptStore = new Map<string, { count: number; expiresAt: number }>();

async function getAttemptCount(userId: string): Promise<number> {
  const key = `kyc:attempts:${userId}`;
  try {
    const current = await redis.get(key);
    return current ? Number(current) : 0;
  } catch {
    const item = memoryAttemptStore.get(userId);
    if (!item || item.expiresAt < Date.now()) return 0;
    return item.count;
  }
}

async function incrementAttemptCount(userId: string): Promise<number> {
  const key = `kyc:attempts:${userId}`;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 24 * 60 * 60);
    }
    return current;
  } catch {
    const existing = memoryAttemptStore.get(userId);
    if (!existing || existing.expiresAt < Date.now()) {
      memoryAttemptStore.set(userId, { count: 1, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
      return 1;
    }
    const next = existing.count + 1;
    memoryAttemptStore.set(userId, { ...existing, count: next });
    return next;
  }
}

router.use(requireAuth);

router.get('/requirements', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { nationality: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');
    res.json(getVerificationRequirements(user.nationality));
  } catch (err) {
    next(err);
  }
});

router.get('/status', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        kycStatus: true,
        idVerificationStatus: true,
        idVerificationProvider: true,
        idVerificationRef: true,
        idVerifiedAt: true,
        idVerificationFailureReason: true,
        dailySwapLimit: true,
        dailySwapUsed: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!user) throw new Error('USER_NOT_FOUND');
    const attemptsUsed = await getAttemptCount(req.userId!);
    res.json({ ...user, attemptsUsed, attemptsRemaining: Math.max(0, 3 - attemptsUsed) });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-identity', async (req: AuthRequest, res, next) => {
  try {
    const payload = verifySchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { nationality: true, idVerificationStatus: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.idVerificationStatus === 'VERIFIED') throw new Error('ID_ALREADY_VERIFIED');

    const attempts = await getAttemptCount(req.userId!);
    if (attempts >= 3) throw new Error('ID_VERIFICATION_ATTEMPTS_EXCEEDED');
    await incrementAttemptCount(req.userId!);

    await prisma.user.update({
      where: { id: req.userId },
      data: { idVerificationStatus: 'PENDING' },
    });

    const result = await verifyIdentity(
      req.userId!,
      user.nationality,
      payload.idNumber,
      payload.firstName,
      payload.lastName,
      payload.dateOfBirth
    );
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
});

export default router;
