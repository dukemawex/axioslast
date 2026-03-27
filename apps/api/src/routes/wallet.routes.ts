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
router.post('/recurring', walletController.createRecurring);
router.get('/recurring', walletController.listRecurring);
router.delete('/recurring/:id', walletController.cancelRecurring);
router.post('/refund', walletController.requestRefund);
router.post('/payment-links', walletController.createPaymentLink);
router.get('/payment-links', walletController.listPaymentLinks);
router.delete('/payment-links/:id', walletController.deactivatePaymentLink);
router.get('/transfers/banks', walletController.listBanks);
router.post('/transfers/resolve', walletController.resolveBankAccount);
router.post('/transfers/send', walletController.sendTransfer);
router.post('/transfers/internal', walletController.transferToAxiosUser);
router.post('/paycodes', walletController.generatePaycode);
router.get('/paycodes', walletController.listPaycodes);

export default router;
