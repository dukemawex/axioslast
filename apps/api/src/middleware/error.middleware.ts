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
  INVALID_TOKEN: { status: 400, message: 'Verification link is invalid or expired. Please request a new one.' },
  INSUFFICIENT_BALANCE: { status: 400, message: 'Insufficient balance for this transaction' },
  WALLET_NOT_FOUND: { status: 404, message: 'Wallet not found' },
  INVALID_AMOUNT: { status: 400, message: 'Invalid amount specified' },
  INVALID_NETWORK: { status: 400, message: 'Invalid network selected' },
  INVALID_PHONE_NUMBER: { status: 400, message: 'Invalid phone number' },
  INVALID_PARAMETERS: { status: 400, message: 'Missing or invalid required fields' },
  INVALID_ACCOUNT_NUMBER: { status: 400, message: 'Invalid account number' },
  SAME_CURRENCY: { status: 400, message: 'Cannot swap between the same currency' },
  UNSUPPORTED_PAIR: { status: 400, message: 'This currency pair is not supported' },
  RATES_UNAVAILABLE: { status: 503, message: 'Live rates are currently unavailable. Please try again shortly.' },
  PAYMENT_INIT_FAILED: { status: 502, message: 'Payment initiation failed. Please try again.' },
  TRANSACTION_NOT_FOUND: { status: 404, message: 'Transaction not found' },
  CARD_NOT_TOKENIZED: { status: 400, message: 'A tokenized card is required. Make a successful card payment first.' },
  REFUND_WINDOW_EXPIRED: { status: 400, message: 'Refund window has expired. Refunds are only allowed within 24 hours.' },
  PIN_INVALID: { status: 400, message: 'Invalid transaction PIN' },
  PIN_NOT_SET: { status: 400, message: 'Transaction PIN is not set' },
  PIN_ALREADY_SET: { status: 400, message: 'Transaction PIN is already set' },
  PIN_TOKEN_REQUIRED: { status: 401, message: 'Transaction PIN verification is required' },
  PIN_TOKEN_EXPIRED: { status: 401, message: 'PIN verification expired. Please verify again.' },
  DAILY_LIMIT_EXCEEDED: { status: 403, message: 'You have exceeded your daily swap limit. Verify your identity to increase limits.' },
  MONTHLY_LIMIT_EXCEEDED: { status: 403, message: 'You have exceeded your monthly swap limit. Verify your identity to increase limits.' },
  LIMIT_ABOVE_KYC_MAX: { status: 400, message: 'Requested limit exceeds your KYC maximum' },
  ACCOUNT_FROZEN: { status: 403, message: 'Your account is frozen' },
  TWO_FACTOR_INVALID: { status: 400, message: 'Invalid two-factor authentication code' },
  TWO_FACTOR_NOT_ENABLED: { status: 400, message: 'Two-factor authentication is not enabled' },
  TWO_FACTOR_SETUP_EXPIRED: { status: 400, message: '2FA setup expired. Please start again.' },
  TWO_FACTOR_TEMP_TOKEN_INVALID: { status: 401, message: 'Invalid or expired 2FA login session' },
  INVALID_NIN: { status: 422, message: 'NIN must be exactly 11 digits.' },
  INVALID_NATIONAL_ID: { status: 422, message: 'ID number format is invalid for your country.' },
  ID_ALREADY_VERIFIED: { status: 400, message: 'Your identity has already been verified.' },
  ID_VERIFICATION_ATTEMPTS_EXCEEDED: { status: 429, message: 'Too many verification attempts. Please try again tomorrow.' },
  VERIFICATION_SERVICE_UNAVAILABLE: { status: 503, message: 'Identity verification is temporarily unavailable. Please try again later.' },
  INTERSWITCH_AUTH_FAILED: { status: 503, message: 'Payment service is temporarily unavailable. Please try again shortly.' },
  TRANSFER_FAILED: { status: 400, message: 'Bank transfer failed. Please check the account details and try again.' },
  ACCOUNT_NOT_FOUND: { status: 404, message: 'Bank account not found. Please check the account number and bank.' },
  INVALID_BVN_FORMAT: { status: 400, message: 'BVN must be exactly 11 digits.' },
  INVALID_NIN_FORMAT: { status: 400, message: 'NIN must be exactly 11 digits.' },
  BVN_VERIFICATION_FAILED: { status: 400, message: 'Your BVN could not be verified. Please ensure your name and date of birth match your BVN records exactly.' },
  NIN_VERIFICATION_FAILED: { status: 400, message: 'Your NIN could not be verified. Please check your details and try again.' },
  NIN_REQUIRES_BVN: { status: 400, message: 'Please verify your BVN before verifying your NIN.' },
  IDENTITY_VERIFICATION_FAILED: { status: 400, message: 'Your identity document could not be verified. Please check your details or try a different document.' },
  COUNTRY_NOT_SUPPORTED: { status: 400, message: 'This country is not yet supported for identity verification.' },
  ID_TYPE_NOT_SUPPORTED: { status: 400, message: 'This document type is not supported for your country.' },
  KYC_ATTEMPTS_EXCEEDED: { status: 429, message: 'You have exceeded the maximum verification attempts for today. Please try again tomorrow.' },
  ALREADY_VERIFIED: { status: 400, message: 'Your identity has already been verified.' },
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
