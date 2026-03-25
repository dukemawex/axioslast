import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().default(30),
  INTERSWITCH_BASE_URL: z.string().url(),
  INTERSWITCH_PASSPORT_URL: z.string().url(),
  INTERSWITCH_CLIENT_ID: z.string().min(1),
  INTERSWITCH_CLIENT_SECRET: z.string().min(1),
  INTERSWITCH_MERCHANT_CODE: z.string().min(1),
  INTERSWITCH_PAY_ITEM_ID: z.string().min(1),
  INTERSWITCH_WEBHOOK_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
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

export const env = result.data;
export type Env = typeof env;
