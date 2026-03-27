import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import walletRoutes from './wallet.routes';
import ratesRoutes from './rates.routes';
import webhookRoutes from './webhook.routes';
import pinRoutes from './pin.routes';
import twoFactorRoutes from './twoFactor.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/wallets', walletRoutes);
router.use('/rates', ratesRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/pin', pinRoutes);
router.use('/2fa', twoFactorRoutes);

export default router;
