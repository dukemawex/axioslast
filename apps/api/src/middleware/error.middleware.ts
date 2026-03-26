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
  PIN_INVALID: { status: 400, message: 'Invalid transaction PIN' },
  PIN_NOT_SET: { status: 400, message: 'Transaction PIN is not set' },
  PIN_ALREADY_SET: { status: 400, message: 'Transaction PIN is already set' },
  PIN_TOKEN_REQUIRED: { status: 401, message: 'Transaction PIN verification is required' },
  PIN_TOKEN_EXPIRED: { status: 401, message: 'PIN verification expired. Please verify again.' },
  DAILY_LIMIT_EXCEEDED: { status: 400, message: 'Daily swap limit exceeded' },
  LIMIT_ABOVE_KYC_MAX: { status: 400, message: 'Requested limit exceeds your KYC maximum' },
  ACCOUNT_FROZEN: { status: 403, message: 'Your account is frozen' },
  TWO_FACTOR_INVALID: { status: 400, message: 'Invalid two-factor authentication code' },
  TWO_FACTOR_NOT_ENABLED: { status: 400, message: 'Two-factor authentication is not enabled' },
  TWO_FACTOR_SETUP_EXPIRED: { status: 400, message: '2FA setup expired. Please start again.' },
  TWO_FACTOR_TEMP_TOKEN_INVALID: { status: 401, message: 'Invalid or expired 2FA login session' },
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
