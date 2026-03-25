import { Router } from 'express';
import * as webhookController from '../controllers/webhook.controller';

const router = Router();

router.post('/interswitch', webhookController.interswitchWebhook);

export default router;
