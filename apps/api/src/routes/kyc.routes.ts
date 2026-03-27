import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import {
  getVerificationRequirements,
  verifyIdentity,
  verifyBvn,
  verifyNin,
  COUNTRY_ID_TYPES,
  KYC_TIER_LIMITS,
} from '../services/identity.service';

const router = Router();

const kycLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'RATE_LIMIT', message: 'Too many requests. Try again later.' },
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'RATE_LIMIT', message: 'Too many verification attempts. Try again later.' },
});

async function getAttemptCount(userId: string): Promise<number> {
  const key = `kyc:attempts:${userId}`;
  try {
    const current = await redis.get(key);
    return current ? Number(current) : 0;
  } catch {
    return 0;
  }
}

async function incrementAttemptCount(userId: string): Promise<number> {
  const key = `kyc:attempts:${userId}`;
  try {
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, 24 * 60 * 60);
    return current;
  } catch {
    return 1;
  }
}

router.use(kycLimiter);
router.use(requireAuth);

// GET /kyc/status — current KYC status and tier
router.get('/status', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        kycStatus: true,
        kycTier: true,
        kycVerifiedAt: true,
        kycRejectionReason: true,
        idVerificationStatus: true,
        idVerificationProvider: true,
        idVerificationRef: true,
        idVerifiedAt: true,
        idVerificationFailureReason: true,
        idType: true,
        idCountry: true,
        bvnHash: true,
        ninHash: true,
        dailySwapLimit: true,
        monthlySwapLimit: true,
        dailySwapUsed: true,
        monthlySwapUsed: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!user) throw new Error('USER_NOT_FOUND');
    const attemptsUsed = await getAttemptCount(req.userId!);
    const tier = (user.kycTier as keyof typeof KYC_TIER_LIMITS) ?? 'NONE';
    const limits = KYC_TIER_LIMITS[tier] ?? KYC_TIER_LIMITS.NONE;
    res.json({
      ...user,
      tier,
      dailyLimit: limits.daily,
      monthlyLimit: limits.monthly,
      hasBvn: Boolean(user.bvnHash),
      hasNin: Boolean(user.ninHash),
      attemptsUsed,
      attemptsRemaining: Math.max(0, 3 - attemptsUsed),
    });
  } catch (err) {
    next(err);
  }
});

// GET /kyc/requirements — legacy single-type requirement lookup
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

// GET /kyc/identity-types/:country — all supported ID types for a country
router.get('/identity-types/:country', (req, res) => {
  const country = req.params.country.toUpperCase();
  const types = COUNTRY_ID_TYPES[country];
  if (!types) {
    res.status(400).json({ error: 'COUNTRY_NOT_SUPPORTED', message: 'This country is not yet supported for identity verification.' });
    return;
  }
  res.json(
    types.map(({ key, label, formatHint, tier }) => ({ key, label, formatHint, tier }))
  );
});

// GET /kyc/limits — current limits and usage
router.get('/limits', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        kycTier: true,
        dailySwapLimit: true,
        monthlySwapLimit: true,
        dailySwapUsed: true,
        monthlySwapUsed: true,
        dailyLimitResetAt: true,
      },
    });
    if (!user) throw new Error('USER_NOT_FOUND');
    res.json({
      tier: user.kycTier ?? 'NONE',
      dailyLimit: Number(user.dailySwapLimit),
      monthlyLimit: Number(user.monthlySwapLimit ?? 200000),
      dailyUsed: Number(user.dailySwapUsed),
      monthlyUsed: Number(user.monthlySwapUsed ?? 0),
      dailyResetAt: user.dailyLimitResetAt,
    });
  } catch (err) {
    next(err);
  }
});

// POST /kyc/verify — general identity verification
const verifySchema = z.object({
  country: z.string().min(2).max(3),
  idType: z.string().min(1),
  idNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
});

router.post('/verify', verifyLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = verifySchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { idVerificationStatus: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const attempts = await getAttemptCount(req.userId!);
    if (attempts >= 3) throw new Error('KYC_ATTEMPTS_EXCEEDED');
    await incrementAttemptCount(req.userId!);

    await prisma.user.update({ where: { id: req.userId }, data: { idVerificationStatus: 'PENDING' } });

    const result = await verifyIdentity(
      req.userId!,
      payload.country,
      payload.idType,
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

// POST /kyc/verify-identity — legacy alias
router.post('/verify-identity', verifyLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = z.object({
      idNumber: z.string().min(1),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      dateOfBirth: z.string().min(1),
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { nationality: true, idVerificationStatus: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.idVerificationStatus === 'VERIFIED') throw new Error('ID_ALREADY_VERIFIED');

    const attempts = await getAttemptCount(req.userId!);
    if (attempts >= 3) throw new Error('ID_VERIFICATION_ATTEMPTS_EXCEEDED');
    await incrementAttemptCount(req.userId!);

    await prisma.user.update({ where: { id: req.userId }, data: { idVerificationStatus: 'PENDING' } });

    const result = await verifyIdentity(
      req.userId!,
      user.nationality,
      'NIN',
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

// POST /kyc/bvn — BVN verification (Nigerian users)
const bvnSchema = z.object({
  bvn: z.string().regex(/^\d{11}$/),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
});

router.post('/bvn', verifyLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = bvnSchema.parse(req.body);
    const result = await verifyBvn(req.userId!, payload.bvn, payload.firstName, payload.lastName, payload.dateOfBirth);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
});

// POST /kyc/nin — NIN verification (requires BVN first)
const ninSchema = z.object({
  nin: z.string().regex(/^\d{11}$/),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

router.post('/nin', verifyLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = ninSchema.parse(req.body);
    const result = await verifyNin(req.userId!, payload.nin, payload.firstName, payload.lastName);
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
