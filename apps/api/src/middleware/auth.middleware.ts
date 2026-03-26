import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';

export interface AuthRequest extends Request {
  userId?: string;
}

async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  options?: { allowFrozen?: boolean }
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'TOKEN_MISSING', message: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      sub: string;
      type: string;
    };

    if (decoded.type !== 'access') {
      res.status(401).json({ error: 'TOKEN_INVALID', message: 'Invalid token type' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { isFrozen: true },
    });

    if (!user) {
      res.status(401).json({ error: 'TOKEN_INVALID', message: 'Invalid token' });
      return;
    }

    if (user.isFrozen && !options?.allowFrozen) {
      res.status(403).json({ error: 'ACCOUNT_FROZEN', message: 'Account is frozen' });
      return;
    }

    req.userId = decoded.sub;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Token has expired' });
    } else {
      res.status(401).json({ error: 'TOKEN_INVALID', message: 'Invalid token' });
    }
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  await authenticate(req, res, next);
}

export async function requireAuthAllowFrozen(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await authenticate(req, res, next, { allowFrozen: true });
}
