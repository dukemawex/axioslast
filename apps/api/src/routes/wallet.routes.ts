import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as walletController from '../controllers/wallet.controller';

const router = Router();

router.use(requireAuth);
router.get('/', walletController.getWallets);
router.post('/fund', walletController.fundWallet);
router.post('/swap', walletController.swapCurrency);
router.get('/transactions', walletController.getTransactions);
router.get('/transactions/:id', walletController.getTransaction);

export default router;
