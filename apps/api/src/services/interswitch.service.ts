import crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { nanoid } from 'nanoid';
import { env } from '../config/env';
import { redis } from '../config/redis';

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
  responseCode?: string;
  status?: string;
  paymentStatus?: string;
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

  try {
    const response = await axios.post<CheckoutResponse>(
      `${env.INTERSWITCH_BASE_URL}/collections/api/v1/getcheckupurl`,
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
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

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

export async function queryTransaction(
  reference: string,
  amountInKobo: number
): Promise<InterswitchTransactionStatus> {
  const token = await getAccessToken();

  try {
    const response = await axios.get<QueryTransactionResponse>(
      `${env.INTERSWITCH_BASE_URL}/collections/api/v1/gettransaction.json`,
      {
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

    const responseCode = response.data.responseCode;
    const normalizedStatus = (response.data.status || response.data.paymentStatus || '').toUpperCase();

    if (responseCode === '00' || normalizedStatus === 'PAID' || normalizedStatus === 'SUCCESSFUL') {
      return 'PAID';
    }

    if (
      responseCode === '09' ||
      normalizedStatus === 'PENDING' ||
      normalizedStatus === 'PROCESSING' ||
      normalizedStatus === 'IN_PROGRESS'
    ) {
      return 'PENDING';
    }

    return 'FAILED';
  } catch (error) {
    logInterswitchApiError('Transaction query', error);
    throw new Error('PAYMENT_INIT_FAILED');
  }
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
