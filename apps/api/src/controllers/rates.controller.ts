import { Request, Response, NextFunction } from 'express';
import * as ratesService from '../services/rates.service';

export async function getAllRates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rates = await ratesService.getAllRates();
    res.json({ rates });
  } catch (err) {
    next(err);
  }
}

export async function getRate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { from, to } = req.params;
    const rate = await ratesService.getRate(from.toUpperCase(), to.toUpperCase());
    res.json({ from: from.toUpperCase(), to: to.toUpperCase(), rate: rate.toString() });
  } catch (err) {
    next(err);
  }
}
