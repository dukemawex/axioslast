import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/prisma';

const updateMeSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
});

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        nationality: true,
        kycStatus: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        updatedAt: true,
        wallets: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
      return;
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateMeSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        nationality: true,
        kycStatus: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}
