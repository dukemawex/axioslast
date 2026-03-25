import crypto from 'crypto';
import { z } from 'zod';

const generatedAccessSecret = crypto.randomBytes(32).toString('hex');
const generatedRefreshSecret = crypto.randomBytes(32).toString('hex');
const generatedWebhookSecret = crypto.randomBytes(32).toString('hex');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  JWT_ACCESS_SECRET: z.string().min(32).default(generatedAccessSecret),
  JWT_REFRESH_SECRET: z.string().min(32).default(generatedRefreshSecret),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().default(30),
  INTERSWITCH_BASE_URL: z.string().url().default('https://example.invalid'),
  INTERSWITCH_PASSPORT_URL: z.string().url().default('https://example.invalid'),
  INTERSWITCH_CLIENT_ID: z.string().min(1).default('placeholder-client-id'),
  INTERSWITCH_CLIENT_SECRET: z.string().min(1).default('placeholder-client-secret'),
  INTERSWITCH_MERCHANT_CODE: z.string().min(1).default('placeholder-merchant-code'),
  INTERSWITCH_PAY_ITEM_ID: z.string().min(1).default('placeholder-pay-item-id'),
  INTERSWITCH_WEBHOOK_SECRET: z.string().min(1).default(generatedWebhookSecret),
  RESEND_API_KEY: z.string().min(1).default('placeholder-resend-api-key'),
  EMAIL_FROM: z.string().default('noreply@axiospay.com'),
  FRONTEND_URL: z
    .string()
    .url()
    .default('http://localhost:3000')
    .transform((value) => new URL(value).origin),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid environment variables:');
  const errors = result.error.flatten().fieldErrors;
  Object.entries(errors).forEach(([key, messages]) => {
    console.error(`  ${key}: ${messages?.join(', ')}`);
  });
  process.exit(1);
}

const defaultedKeys = [
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'INTERSWITCH_BASE_URL',
  'INTERSWITCH_PASSPORT_URL',
  'INTERSWITCH_CLIENT_ID',
  'INTERSWITCH_CLIENT_SECRET',
  'INTERSWITCH_MERCHANT_CODE',
  'INTERSWITCH_PAY_ITEM_ID',
  'INTERSWITCH_WEBHOOK_SECRET',
  'RESEND_API_KEY',
] as const;

const missingKeys = defaultedKeys.filter((key) => !process.env[key]);
if (missingKeys.length > 0) {
  console.warn(
    `⚠️ Missing optional environment variables. Using safe defaults for: ${missingKeys.join(', ')}`
  );
}

export const env = result.data;
export type Env = typeof env;
