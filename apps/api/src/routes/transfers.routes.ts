import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.middleware';
import * as walletController from '../controllers/wallet.controller';

const router = Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: 'RATE_LIMIT', message: 'Too many requests. Try again later.' },
});

router.use(apiLimiter);
router.use(requireAuth);

router.get('/banks', walletController.listBanks);
router.post('/resolve', walletController.resolveBankAccount);
router.post('/send', walletController.sendTransfer);
router.post('/internal', walletController.transferToAxiosUser);

export default router;
