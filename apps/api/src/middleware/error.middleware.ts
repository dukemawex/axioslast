import { Request, Response, NextFunction } from 'express';

const ERROR_MAP: Record<string, { status: number; message: string }> = {
  EMAIL_EXISTS: { status: 409, message: 'An account with this email already exists' },
  PHONE_EXISTS: { status: 409, message: 'An account with this phone number already exists' },
  INVALID_CREDENTIALS: { status: 401, message: 'Invalid email or password' },
  EMAIL_NOT_VERIFIED: { status: 403, message: 'Please verify your email before logging in' },
  OTP_EXPIRED: { status: 400, message: 'The verification code has expired. Please request a new one.' },
  OTP_INVALID: { status: 400, message: 'Invalid verification code' },
  SESSION_NOT_FOUND: { status: 401, message: 'Session not found. Please log in again.' },
  SESSION_EXPIRED: { status: 401, message: 'Your session has expired. Please log in again.' },
  USER_NOT_FOUND: { status: 404, message: 'User not found' },
  EMAIL_ALREADY_VERIFIED: { status: 400, message: 'Email is already verified' },
  INSUFFICIENT_BALANCE: { status: 400, message: 'Insufficient balance for this transaction' },
  WALLET_NOT_FOUND: { status: 404, message: 'Wallet not found' },
  INVALID_AMOUNT: { status: 400, message: 'Invalid amount specified' },
  SAME_CURRENCY: { status: 400, message: 'Cannot swap between the same currency' },
  UNSUPPORTED_PAIR: { status: 400, message: 'This currency pair is not supported' },
  PAYMENT_INIT_FAILED: { status: 502, message: 'Payment initiation failed. Please try again.' },
  TRANSACTION_NOT_FOUND: { status: 404, message: 'Transaction not found' },
};

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const mapped = ERROR_MAP[err.message];
  if (mapped) {
    res.status(mapped.status).json({ error: err.message, message: mapped.message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
}
