import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import type { RegisterInput } from '../services/auth.service';

const registerSchema: z.ZodType<RegisterInput> = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  nationality: z.enum(['NG', 'UG', 'KE', 'GH', 'ZA']),
});

const verifyEmailSchema = z.object({
  userId: z.string().min(1),
  otp: z.string().length(6),
});

const verifyPhoneSchema = z.object({
  userId: z.string().min(1),
  otp: z.string().length(6),
});

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
});

const resendOTPSchema = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
}).refine((data) => Boolean(data.userId || data.email), {
  message: 'Provide userId or email to resend verification',
});

const verifyEmailLinkSchema = z.object({
  token: z.string().min(1),
  userId: z.string().min(1),
});

const verify2FASchema = z.object({
  tempToken: z.string().min(1),
  token: z.string().length(6),
});

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      userId: result.userId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function verifyEmailLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, userId } = verifyEmailLinkSchema.parse(req.query);
    const result = await authService.verifyEmailLink(userId, token);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = verifyEmailSchema.parse(req.body);
    const result = await authService.verifyEmail(data.userId, data.otp);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function verifyPhone(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = verifyPhoneSchema.parse(req.body);
    const result = await authService.verifyPhone(data.userId, data.otp);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login({
      identifier: data.identifier,
      password: data.password,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(email);
    res.json({ message: 'If that email exists, a reset code has been sent.' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(data.email, data.otp, data.newPassword);
    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function resendOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = resendOTPSchema.parse(req.body);
    const result = await authService.resendOTP(data);
    res.json({ message: 'Verification email sent! Check your inbox.', userId: result.userId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function verify2FALogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = verify2FASchema.parse(req.body);
    const result = await authService.verify2FALogin(
      data.tempToken,
      data.token,
      req.headers['user-agent'],
      req.ip
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
