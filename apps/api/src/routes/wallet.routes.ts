import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.middleware';
import * as walletController from '../controllers/wallet.controller';

const router = Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'RATE_LIMIT', message: 'Too many requests. Try again later.' },
});

router.use(apiLimiter);
router.use(requireAuth);
router.get('/', walletController.getWallets);
router.post('/deposit/initiate', walletController.fundWallet);
router.post('/fund', walletController.fundWallet);
router.get('/deposit/verify/:reference', walletController.verifyDeposit);
router.post('/swap', walletController.swapCurrency);
router.get('/transactions', walletController.getTransactions);
router.get('/transactions/:id', walletController.getTransaction);

export default router;
