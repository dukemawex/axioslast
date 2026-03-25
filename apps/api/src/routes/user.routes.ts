import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

router.use(requireAuth);
router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);

export default router;
