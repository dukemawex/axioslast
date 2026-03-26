import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ratesController from '../controllers/rates.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'RATE_LIMIT', message: 'Too many refresh attempts. Try again later.' },
});

router.get('/health', ratesController.getHealth);
router.post('/refresh', refreshLimiter, requireAuth, ratesController.refreshRates);
router.get('/', ratesController.getAllRates);
router.get('/:from/:to', ratesController.getRate);

export default router;
