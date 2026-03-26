import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import * as pinService from '../services/pin.service';

const router = Router();
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'RATE_LIMIT', message: 'Too many requests. Try again later.' },
});

const setPinSchema = z.object({
  pin: z.string().length(4),
});

const verifyPinSchema = z.object({
  pin: z.string().length(4),
});

const changePinSchema = z.object({
  currentPin: z.string().length(4),
  newPin: z.string().length(4),
});

router.use(apiLimiter);
router.use(requireAuth);

router.post('/set', async (req: AuthRequest, res, next) => {
  try {
    const data = setPinSchema.parse(req.body);
    await pinService.setPin(req.userId!, data.pin);
    res.status(201).json({ message: 'PIN set successfully' });
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
    const data = verifyPinSchema.parse(req.body);
    await pinService.verifyPin(req.userId!, data.pin);
    const pinToken = await pinService.createPinToken(req.userId!);
    res.json({ pinToken, expiresIn: 300 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
});

router.post('/change', async (req: AuthRequest, res, next) => {
  try {
    const data = changePinSchema.parse(req.body);
    await pinService.changePin(req.userId!, data.currentPin, data.newPin);
    res.json({ message: 'PIN changed successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
});

export default router;
