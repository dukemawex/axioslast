import crypto from 'crypto';
import { z } from 'zod';

function buildFallbackSecret(name: string): string {
  return crypto
    .createHash('sha256')
    .update(`${name}:${process.env.DATABASE_URL ?? 'axiospay-local'}`)
    .digest('hex');
}

const generatedAccessSecret = buildFallbackSecret('jwt-access');
const generatedRefreshSecret = buildFallbackSecret('jwt-refresh');
const generatedWebhookSecret = buildFallbackSecret('interswitch-webhook');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  JWT_ACCESS_SECRET: z.string().min(32).default(generatedAccessSecret),
  JWT_REFRESH_SECRET: z.string().min(32).default(generatedRefreshSecret),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().default(30),
  INTERSWITCH_BASE_URL: z.string().url().optional(),
  INTERSWITCH_PASSPORT_URL: z.string().url().optional(),
  INTERSWITCH_CLIENT_ID: z.string().min(1).optional(),
  INTERSWITCH_CLIENT_SECRET: z.string().min(1).optional(),
  INTERSWITCH_MERCHANT_CODE: z.string().min(1).optional(),
  INTERSWITCH_PAY_ITEM_ID: z.string().min(1).optional(),
  INTERSWITCH_WEBHOOK_SECRET: z.string().min(1).default(generatedWebhookSecret),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().default('noreply@axiospay.com'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
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
  'INTERSWITCH_WEBHOOK_SECRET',
] as const;

const missingKeys = defaultedKeys.filter((key) => !process.env[key]);
if (missingKeys.length > 0) {
  console.warn(
    `⚠️ Missing environment variables. Using fallback runtime values for: ${missingKeys.join(', ')}`
  );
}

const disabledIntegrations = [
  'INTERSWITCH_BASE_URL',
  'INTERSWITCH_PASSPORT_URL',
  'INTERSWITCH_CLIENT_ID',
  'INTERSWITCH_CLIENT_SECRET',
  'INTERSWITCH_MERCHANT_CODE',
  'INTERSWITCH_PAY_ITEM_ID',
  'RESEND_API_KEY',
] as const;

const missingIntegrationKeys = disabledIntegrations.filter((key) => !process.env[key]);
if (missingIntegrationKeys.length > 0) {
  console.warn(
    `⚠️ Optional integrations disabled until configured: ${missingIntegrationKeys.join(', ')}`
  );
}

export const env = result.data;
export type Env = typeof env;
