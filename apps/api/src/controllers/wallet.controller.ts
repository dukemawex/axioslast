import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import * as walletService from '../services/wallet.service';
import { prisma } from '../config/prisma';

const SUPPORTED_CURRENCIES = ['NGN', 'UGX', 'KES', 'GHS', 'ZAR'];

const fundSchema = z.object({
  currency: z.enum(['NGN', 'UGX', 'KES', 'GHS', 'ZAR']),
  amount: z.number().min(100),
});

const swapSchema = z.object({
  fromCurrency: z.enum(['NGN', 'UGX', 'KES', 'GHS', 'ZAR']),
  toCurrency: z.enum(['NGN', 'UGX', 'KES', 'GHS', 'ZAR']),
  fromAmount: z.number().positive(),
});

export async function getWallets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const wallets = await walletService.getWallets(req.userId!);
    res.json(wallets);
  } catch (err) {
    next(err);
  }
}

export async function fundWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = fundSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
      return;
    }

    const result = await walletService.fundWallet(
      req.userId!,
      data.currency,
      data.amount,
      user.email,
      `${user.firstName} ${user.lastName}`
    );

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function swapCurrency(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = swapSchema.parse(req.body);
    const result = await walletService.swapCurrency(
      req.userId!,
      data.fromCurrency,
      data.toCurrency,
      data.fromAmount,
      req.header('X-Pin-Token') || undefined
    );
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function getTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string | undefined;

    const result = await walletService.getTransactions(req.userId!, page, limit, type);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const transaction = await walletService.getTransaction(req.userId!, req.params.id);
    res.json(transaction);
  } catch (err) {
    next(err);
  }
}
