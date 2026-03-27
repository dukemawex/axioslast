import crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { nanoid } from 'nanoid';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { prisma } from '../config/prisma';
import { sendRateProvidersOutageEmail } from './email.service';

const TOKEN_CACHE_KEY = 'interswitch:token';
const BANK_LIST_CACHE_KEY = 'interswitch:banks';
const BANK_LIST_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const MAX_BACKOFF_MS = 8000;

interface OAuthTokenResponse {
  access_token: string;
  expires_in?: number;
}

interface QueryTransactionResponse {
  ResponseCode?: string;
  responseCode?: string;
  status?: string;
  paymentStatus?: string;
  amount?: number | string;
  Amount?: number | string;
  cardToken?: string;
  paymentToken?: string;
  token?: string;
  Description?: string;
  description?: string;
}

function logInterswitchApiError(context: string, error: unknown): void {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    console.error(`[Interswitch] ${context} failed`, {
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      message: axiosError.message,
    });
    return;
  }

  console.error(`[Interswitch] ${context} failed`, error);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const backoff = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
        console.warn(`[Interswitch] ${context} attempt ${attempt + 1} failed, retrying in ${backoff}ms`, error);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }
  throw lastError;
}

export async function getAccessToken(): Promise<string> {
  try {
    const cachedToken = await redis.get(TOKEN_CACHE_KEY);
    if (cachedToken) {
      return cachedToken;
    }
  } catch (error) {
    console.warn('[Interswitch] Failed to read token from Redis cache', error);
  }

  const credentials = Buffer.from(
    `${env.INTERSWITCH_CLIENT_ID}:${env.INTERSWITCH_CLIENT_SECRET}`
  ).toString('base64');

  try {
    const response = await withRetry(
      () => axios.post<OAuthTokenResponse>(
        `${env.INTERSWITCH_PASSPORT_URL}/passport/oauth/token`,
        'grant_type=client_credentials&scope=profile',
        {
          timeout: 20000,
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      ),
      'OAuth token fetch'
    );

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in ?? 3600;
    const cacheTtl = Math.max(expiresIn - 60, 1);

    try {
      await redis.set(TOKEN_CACHE_KEY, token, 'EX', cacheTtl);
    } catch (error) {
      console.warn('[Interswitch] Failed to cache token in Redis', error);
    }

    return token;
  } catch (error) {
    logInterswitchApiError('OAuth token fetch', error);
    throw new Error('INTERSWITCH_AUTH_FAILED');
  }
}

interface InitiatePaymentParams {
  amount: number; // amount in NGN
  userId: string;
  userEmail: string;
  userName?: string;
  userPhone?: string;
  description?: string;
  reference?: string;
}

export async function initiatePayment(
  params: InitiatePaymentParams
): Promise<{ reference: string; amountInKobo: number }> {
  const reference = params.reference ?? nanoid(20);
  const amountInKobo = Math.round(params.amount * 100);

  console.info('[Interswitch] initiatePayment', {
    userId: params.userId,
    amountInKobo,
    reference,
  });

  return { reference, amountInKobo };
}

export type InterswitchTransactionStatus = 'PAID' | 'PENDING' | 'FAILED';

export interface InterswitchTransactionQueryResult {
  status: InterswitchTransactionStatus;
  amountInKobo: number | null;
  responseCode?: string;
  responseDescription?: string;
  cardToken?: string;
}

function normalizeAmountInKobo(amount: unknown): number | null {
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return Math.round(amount);
  }

  if (typeof amount === 'string') {
    const parsed = Number(amount);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }

  return null;
}

export async function queryTransaction(
  reference: string,
  amountInKobo: number
): Promise<InterswitchTransactionQueryResult> {
  const token = await getAccessToken();

  console.info('[Interswitch] queryTransaction', { reference, amountInKobo });

  try {
    const response = await withRetry(
      () => axios.get<QueryTransactionResponse>(
        `${env.INTERSWITCH_BASE_URL}/collections/api/v1/gettransaction.json`,
        {
          timeout: 25000,
          params: {
            merchantcode: env.INTERSWITCH_MERCHANT_CODE,
            transactionreference: reference,
            amount: amountInKobo,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      ),
      'Transaction query'
    );

    console.info('[Interswitch] queryTransaction response', {
      reference,
      status: response.status,
      data: response.data,
    });

    const responseCode = response.data.ResponseCode ?? response.data.responseCode;
    const responseDescription = response.data.Description ?? response.data.description;
    const normalizedStatus = (response.data.status || response.data.paymentStatus || '').toUpperCase();
    const queriedAmount = normalizeAmountInKobo(response.data.Amount ?? response.data.amount);
    const cardToken =
      response.data.cardToken ?? response.data.paymentToken ?? response.data.token;

    if (queriedAmount !== null && queriedAmount !== amountInKobo) {
      console.error('[Interswitch] Amount mismatch during requery', {
        reference,
        expectedAmountInKobo: amountInKobo,
        queriedAmountInKobo: queriedAmount,
      });
      void sendRateProvidersOutageEmail(
        env.ADMIN_EMAIL,
        `Interswitch amount mismatch detected\nreference=${reference}\nexpected=${amountInKobo}\nactual=${queriedAmount}`
      ).catch(() => {});
      return { status: 'FAILED', amountInKobo: queriedAmount, responseCode, responseDescription, cardToken };
    }

    if (responseCode === '00' || normalizedStatus === 'PAID' || normalizedStatus === 'SUCCESSFUL') {
      return { status: 'PAID', amountInKobo: queriedAmount, responseCode, responseDescription, cardToken };
    }

    if (
      responseCode === '09' ||
      normalizedStatus === 'PENDING' ||
      normalizedStatus === 'PROCESSING' ||
      normalizedStatus === 'IN_PROGRESS'
    ) {
      return { status: 'PENDING', amountInKobo: queriedAmount, responseCode, responseDescription, cardToken };
    }

    return { status: 'FAILED', amountInKobo: queriedAmount, responseCode, responseDescription, cardToken };
  } catch (error) {
    logInterswitchApiError('Transaction query', error);
    throw new Error('PAYMENT_INIT_FAILED');
  }
}

export async function tokeniseCard(userId: string, txnRef: string): Promise<string | null> {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { reference: txnRef },
    });
    if (!transaction || transaction.userId !== userId) {
      return null;
    }
    const metadata =
      transaction.metadata && typeof transaction.metadata === 'object' && !Array.isArray(transaction.metadata)
        ? (transaction.metadata as Record<string, unknown>)
        : null;
    const token = metadata?.cardToken;
    return typeof token === 'string' && token.trim().length > 0 ? token : null;
  } catch {
    return null;
  }
}

export async function chargeToken(
  _userId: string,
  amount: number,
  tokenValue: string
): Promise<{ success: boolean; reference: string }> {
  const token = await getAccessToken();
  const reference = nanoid(20);
  try {
    const response = await axios.post(
      `${env.INTERSWITCH_BASE_URL}/api/v1/recurring/charge`,
      {
        token: tokenValue,
        amount: Math.round(amount * 100),
        merchantCode: env.INTERSWITCH_MERCHANT_CODE,
        reference,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const status = String((response.data as { status?: string; responseCode?: string }).status || '').toUpperCase();
    const responseCode = String((response.data as { responseCode?: string }).responseCode || '');
    return {
      success: status === 'SUCCESS' || responseCode === '00',
      reference,
    };
  } catch (error) {
    logInterswitchApiError('Charge token', error);
    return { success: false, reference };
  }
}

export async function initiateRefund(
  transactionRef: string,
  amountInKobo: number,
  reason: string
): Promise<{ status: string; reference: string }> {
  const token = await getAccessToken();
  console.info('[Interswitch] initiateRefund', { transactionRef, amountInKobo, reason });
  const response = await withRetry(
    () => axios.post(
      `${env.INTERSWITCH_BASE_URL}/api/v1/refunds`,
      {
        transactionReference: transactionRef,
        amount: amountInKobo,
        refundReason: reason,
      },
      {
        timeout: 25000,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    ),
    'Refund'
  );
  return {
    status: String((response.data as { status?: string }).status || 'PENDING'),
    reference: transactionRef,
  };
}

export async function createPaymentLink(
  userId: string,
  amount: number,
  description: string,
  expiresAt: Date
): Promise<{ reference: string; linkUrl: string }> {
  const reference = nanoid(20);
  const encoded = encodeURIComponent(`${description}-${userId}-${amount}-${expiresAt.toISOString()}`);
  return {
    reference,
    linkUrl: `${env.FRONTEND_URL}/pay/${encoded}`,
  };
}

export async function getBankList(): Promise<Array<{ code: string; name: string }>> {
  try {
    const cached = await redis.get(BANK_LIST_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as Array<{ code: string; name: string }>;
    }
  } catch {
    // ignore cache miss
  }

  const token = await getAccessToken();
  const response = await withRetry(
    () => axios.get(`${env.INTERSWITCH_BASE_URL}/api/v1/banks`, {
      timeout: 25000,
      headers: { Authorization: `Bearer ${token}` },
    }),
    'Get bank list'
  );
  const banks = (response.data as { data?: Array<{ code?: string; name?: string }> }).data || [];
  const result = banks
    .filter((bank) => bank.code && bank.name)
    .map((bank) => ({ code: String(bank.code), name: String(bank.name) }));

  try {
    await redis.set(BANK_LIST_CACHE_KEY, JSON.stringify(result), 'EX', BANK_LIST_CACHE_TTL);
  } catch {
    // ignore cache write failure
  }

  return result;
}

export async function resolveAccount(
  bankCode: string,
  accountNumber: string
): Promise<{ accountName: string }> {
  const token = await getAccessToken();
  console.info('[Interswitch] resolveAccount', { bankCode, accountNumber });
  const response = await withRetry(
    () => axios.post(
      `${env.INTERSWITCH_BASE_URL}/api/v1/transfers/resolve`,
      { bankCode, accountNumber },
      {
        timeout: 25000,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    ),
    'Resolve account'
  );
  const accountName = String(
    (response.data as { accountName?: string; data?: { accountName?: string } }).accountName ||
      (response.data as { data?: { accountName?: string } }).data?.accountName ||
      ''
  );
  if (!accountName) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }
  return { accountName };
}

export interface SendMoneyParams {
  beneficiaryBankCode: string;
  beneficiaryAccountNumber: string;
  beneficiaryAccountName: string;
  amount: number; // in NGN
  narration?: string;
  senderName: string;
  reference?: string;
}

export async function sendMoney(
  _userId: string,
  params: SendMoneyParams
): Promise<{ status: 'SUCCESS' | 'FAILED'; reference: string }> {
  const token = await getAccessToken();
  const reference = params.reference ?? nanoid(20);
  const amountInKobo = Math.round(params.amount * 100);

  console.info('[Interswitch] sendMoney', {
    beneficiaryBankCode: params.beneficiaryBankCode,
    beneficiaryAccountNumber: params.beneficiaryAccountNumber,
    amountInKobo,
    reference,
    senderName: params.senderName,
  });

  const response = await withRetry(
    () => axios.post(
      `${env.INTERSWITCH_BASE_URL}/api/v1/transfers`,
      {
        beneficiaryBankCode: params.beneficiaryBankCode,
        beneficiaryAccountNumber: params.beneficiaryAccountNumber,
        beneficiaryAccountName: params.beneficiaryAccountName,
        amount: amountInKobo,
        narration: params.narration || 'Axios Pay Wallet Withdrawal',
        senderName: params.senderName,
        reference,
      },
      {
        timeout: 30000,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    ),
    'Send money'
  );

  const responseCode = String(
    (response.data as { responseCode?: string; ResponseCode?: string }).responseCode ||
    (response.data as { ResponseCode?: string }).ResponseCode ||
    ''
  );
  const status = String((response.data as { status?: string }).status || '').toUpperCase();

  if (responseCode !== '00' && status !== 'SUCCESS') {
    console.error('[Interswitch] sendMoney failed', { responseCode, status, reference });
    throw new Error('TRANSFER_FAILED');
  }

  return { status: 'SUCCESS', reference };
}

export type AirtimeNetwork = 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';

const AIRTIME_NETWORK_CODES: Record<AirtimeNetwork, string> = {
  MTN: '01',
  AIRTEL: '02',
  GLO: '03',
  '9MOBILE': '04',
};

export async function rechargeAirtime(
  phoneNumber: string,
  amountNGN: number,
  network: AirtimeNetwork
): Promise<{ status: string; reference: string }> {
  const token = await getAccessToken();
  const reference = nanoid(20);
  const amountInKobo = Math.round(amountNGN * 100);
  const networkCode = AIRTIME_NETWORK_CODES[network];

  console.info('[Interswitch] rechargeAirtime', { phoneNumber, amountInKobo, network, networkCode });

  const response = await withRetry(
    () => axios.post(
      `${env.INTERSWITCH_BASE_URL}/api/v1/airtime`,
      {
        phoneNumber,
        amount: amountInKobo,
        networkCode,
        reference,
      },
      {
        timeout: 25000,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    ),
    'Airtime recharge'
  );

  const status = String((response.data as { status?: string }).status || 'PENDING').toUpperCase();
  console.info('[Interswitch] rechargeAirtime response', { reference, status });
  return { status, reference };
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha512', env.INTERSWITCH_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
