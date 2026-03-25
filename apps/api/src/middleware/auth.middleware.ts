import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
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
