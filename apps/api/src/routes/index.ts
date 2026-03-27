import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import walletRoutes from './wallet.routes';
import ratesRoutes from './rates.routes';
import webhookRoutes from './webhook.routes';
import pinRoutes from './pin.routes';
import twoFactorRoutes from './twoFactor.routes';
import billsRoutes from './bills.routes';
import paymentLinksRoutes from './payment-links.routes';
import transfersRoutes from './transfers.routes';
import paycodesRoutes from './paycodes.routes';
import kycRoutes from './kyc.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/wallets', walletRoutes);
router.use('/rates', ratesRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/pin', pinRoutes);
router.use('/2fa', twoFactorRoutes);
router.use('/bills', billsRoutes);
router.use('/payment-links', paymentLinksRoutes);
router.use('/transfers', transfersRoutes);
router.use('/paycodes', paycodesRoutes);
router.use('/kyc', kycRoutes);

export default router;
