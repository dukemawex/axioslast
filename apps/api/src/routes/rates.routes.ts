import { Router } from 'express';
import * as ratesController from '../controllers/rates.controller';

const router = Router();

router.get('/', ratesController.getAllRates);
router.get('/:from/:to', ratesController.getRate);

export default router;
