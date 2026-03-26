import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireAuthAllowFrozen } from '../middleware/auth.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'RATE_LIMIT', message: 'Too many requests. Try again later.' },
});

router.use(apiLimiter);
router.post('/unfreeze', requireAuthAllowFrozen, userController.unfreezeAccount);
router.post('/unfreeze/request-otp', requireAuthAllowFrozen, userController.requestUnfreezeOtp);

router.use(requireAuth);
router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.patch('/limits', userController.updateDailyLimit);
router.post('/freeze', userController.freezeAccount);

export default router;
