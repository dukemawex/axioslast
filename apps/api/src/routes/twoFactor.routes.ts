import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import * as twoFactorService from '../services/twoFactor.service';

const router = Router();

const tokenSchema = z.object({
  token: z.string().length(6),
});

router.use(requireAuth);

router.post('/setup', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const result = await twoFactorService.generateSecret(req.userId!, user.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/enable', async (req: AuthRequest, res, next) => {
  try {
    const data = tokenSchema.parse(req.body);
    await twoFactorService.verifyAndEnable(req.userId!, data.token);
    res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
});

router.post('/verify', async (req: AuthRequest, res, next) => {
  try {
    const data = tokenSchema.parse(req.body);
    const valid = await twoFactorService.verifyToken(req.userId!, data.token);
    if (!valid) throw new Error('TWO_FACTOR_INVALID');
    res.json({ verified: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
});

router.post('/disable', async (req: AuthRequest, res, next) => {
  try {
    const data = tokenSchema.parse(req.body);
    await twoFactorService.disable(req.userId!, data.token);
    res.json({ message: '2FA disabled successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
});

export default router;
