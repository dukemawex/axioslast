import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env';

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: AccessTokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 30000) {
    return tokenCache.token;
  }

  const credentials = Buffer.from(
    `${env.INTERSWITCH_CLIENT_ID}:${env.INTERSWITCH_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post(
    `${env.INTERSWITCH_PASSPORT_URL}/oauth/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const expiresIn = (response.data.expires_in || 3600) * 1000;
  tokenCache = {
    token: response.data.access_token,
    expiresAt: Date.now() + expiresIn,
  };

  return tokenCache.token;
}

interface InitiatePaymentParams {
  txRef: string;
  amount: number; // in kobo/lowest denomination
  currency: string;
  customerEmail: string;
  customerName: string;
  redirectUrl: string;
}

export async function initiatePayment(params: InitiatePaymentParams): Promise<string> {
  try {
    const token = await getAccessToken();
    const response = await axios.post(
      `${env.INTERSWITCH_BASE_URL}/collections/api/v1/purchases`,
      {
        merchantCode: env.INTERSWITCH_MERCHANT_CODE,
        payableCode: env.INTERSWITCH_PAY_ITEM_ID,
        transactionReference: params.txRef,
        amount: params.amount,
        currency: params.currency,
        redirectUrl: params.redirectUrl,
        customerEmail: params.customerEmail,
        customerName: params.customerName,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.redirectUrl || buildWebpayUrl(params.txRef, params.amount);
  } catch {
    return buildWebpayUrl(params.txRef, params.amount);
  }
}

function buildWebpayUrl(txRef: string, amountInKobo: number): string {
  return `https://webpay.interswitchng.com/collections/w/pay?code=${env.INTERSWITCH_MERCHANT_CODE}&amount=${amountInKobo}&txnref=${txRef}&others=ST_0`;
}

export async function queryTransaction(txRef: string, amountInKobo: number): Promise<{
  responseCode: string;
  responseDescription: string;
  amount: number;
  transactionReference: string;
}> {
  const hash = crypto
    .createHash('sha512')
    .update(`${env.INTERSWITCH_MERCHANT_CODE}:${txRef}:${env.INTERSWITCH_CLIENT_SECRET}`)
    .digest('hex');

  const token = await getAccessToken();
  const response = await axios.get(
    `${env.INTERSWITCH_BASE_URL}/collections/api/v1/gettransaction.json?merchantcode=${env.INTERSWITCH_MERCHANT_CODE}&transactionreference=${txRef}&amount=${amountInKobo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Hash: hash,
      },
    }
  );

  return response.data;
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const expected = crypto
    .createHmac('sha512', env.INTERSWITCH_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}
