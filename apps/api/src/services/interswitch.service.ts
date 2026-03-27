import crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { nanoid } from 'nanoid';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { prisma } from '../config/prisma';
import { sendRateProvidersOutageEmail } from './email.service';

const TOKEN_CACHE_KEY = 'interswitch:token';

interface OAuthTokenResponse {
  access_token: string;
  expires_in?: number;
}

interface CheckoutResponse {
  paymentLink?: string;
  paymentUrl?: string;
  checkoutUrl?: string;
  data?: {
    paymentLink?: string;
    paymentUrl?: string;
    checkoutUrl?: string;
  };
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
    const response = await axios.post<OAuthTokenResponse>(
      `${env.INTERSWITCH_PASSPORT_URL}/passport/oauth/token`,
      'grant_type=client_credentials&scope=profile',
      {
        timeout: 20000,
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
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
    throw new Error('PAYMENT_INIT_FAILED');
  }
}

interface InitiatePaymentParams {
  amount: number; // amount in NGN
  userId: string;
  userEmail: string;
}

export async function initiatePayment(
  params: InitiatePaymentParams
): Promise<{ paymentUrl: string; reference: string }> {
  const reference = nanoid(20);
  const amountInKobo = Math.round(params.amount * 100);
  const token = await getAccessToken();

  const checkoutEndpointCandidates = [
    '/collections/api/v1/getcheckupurl',
    '/collections/api/v1/getcheckouturl',
  ];

  try {
    let response: { data: CheckoutResponse } | null = null;
    let lastError: unknown = null;

    for (const endpoint of checkoutEndpointCandidates) {
      try {
        response = await axios.post<CheckoutResponse>(
          `${env.INTERSWITCH_BASE_URL}${endpoint}`,
          {
            merchantCode: env.INTERSWITCH_MERCHANT_CODE,
            payableCode: env.INTERSWITCH_PAY_ITEM_ID,
            amount: amountInKobo,
            redirectUrl: `${env.FRONTEND_URL}/dashboard/deposit/callback`,
            currencyCode: '566',
            customerId: params.userId,
            customerEmail: params.userEmail,
            transactionReference: reference,
            description: 'Axios Pay Wallet Deposit',
          },
          {
            timeout: 25000,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        break;
      } catch (error) {
        lastError = error;
        if (axios.isAxiosError(error) && error.response?.status !== 404) {
          break;
        }
      }
    }

    if (!response) {
      throw lastError ?? new Error('PAYMENT_INIT_FAILED');
    }

    const paymentUrl =
      response.data.paymentUrl ??
      response.data.paymentLink ??
      response.data.checkoutUrl ??
      response.data.data?.paymentUrl ??
      response.data.data?.paymentLink ??
      response.data.data?.checkoutUrl;

    if (!paymentUrl) {
      console.error('[Interswitch] Checkout initiation returned empty payment URL', {
        data: response.data,
      });
      throw new Error('PAYMENT_INIT_FAILED');
    }

    return { paymentUrl, reference };
  } catch (error) {
    logInterswitchApiError('Checkout initiation', error);
    throw new Error('PAYMENT_INIT_FAILED');
  }
}

export type InterswitchTransactionStatus = 'PAID' | 'PENDING' | 'FAILED';

export interface InterswitchTransactionQueryResult {
  status: InterswitchTransactionStatus;
  amountInKobo: number | null;
  responseCode?: string;
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

  try {
    const response = await axios.get<QueryTransactionResponse>(
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
    );

    const responseCode = response.data.ResponseCode ?? response.data.responseCode;
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
      return { status: 'FAILED', amountInKobo: queriedAmount, responseCode, cardToken };
    }

    if (responseCode === '00' || normalizedStatus === 'PAID' || normalizedStatus === 'SUCCESSFUL') {
      return { status: 'PAID', amountInKobo: queriedAmount, responseCode, cardToken };
    }

    if (
      responseCode === '09' ||
      normalizedStatus === 'PENDING' ||
      normalizedStatus === 'PROCESSING' ||
      normalizedStatus === 'IN_PROGRESS'
    ) {
      return { status: 'PENDING', amountInKobo: queriedAmount, responseCode, cardToken };
    }

    return { status: 'FAILED', amountInKobo: queriedAmount, responseCode, cardToken };
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
  amount: number,
  reason: string
): Promise<{ status: string; reference: string }> {
  const token = await getAccessToken();
  const response = await axios.post(
    `${env.INTERSWITCH_BASE_URL}/api/v1/refunds`,
    {
      transactionReference: transactionRef,
      amount,
      refundReason: reason,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
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
  const token = await getAccessToken();
  const response = await axios.get(`${env.INTERSWITCH_BASE_URL}/api/v1/banks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const banks = (response.data as { data?: Array<{ code?: string; name?: string }> }).data || [];
  return banks
    .filter((bank) => bank.code && bank.name)
    .map((bank) => ({ code: String(bank.code), name: String(bank.name) }));
}

export async function resolveAccount(
  bankCode: string,
  accountNumber: string
): Promise<{ accountName: string }> {
  const token = await getAccessToken();
  const response = await axios.post(
    `${env.INTERSWITCH_BASE_URL}/api/v1/transfers/resolve`,
    {
      bankCode,
      accountNumber,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const accountName = String(
    (response.data as { accountName?: string; data?: { accountName?: string } }).accountName ||
      (response.data as { data?: { accountName?: string } }).data?.accountName ||
      ''
  );
  if (!accountName) {
    throw new Error('PAYMENT_INIT_FAILED');
  }
  return { accountName };
}

export interface SendMoneyParams {
  beneficiaryBankCode: string;
  beneficiaryAccountNumber: string;
  beneficiaryAccountName: string;
  amount: number;
  narration?: string;
  senderName: string;
}

export async function sendMoney(
  _userId: string,
  params: SendMoneyParams
): Promise<{ status: 'SUCCESS' | 'FAILED'; reference: string }> {
  const token = await getAccessToken();
  const reference = nanoid(20);
  const response = await axios.post(
    `${env.INTERSWITCH_BASE_URL}/api/v1/transfers`,
    {
      beneficiaryBankCode: params.beneficiaryBankCode,
      beneficiaryAccountNumber: params.beneficiaryAccountNumber,
      beneficiaryAccountName: params.beneficiaryAccountName,
      amount: Math.round(params.amount * 100),
      narration: params.narration || 'Axios Pay Wallet Withdrawal',
      senderName: params.senderName,
      reference,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const status = String((response.data as { status?: string }).status || '').toUpperCase();
  return {
    status: status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
    reference,
  };
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
