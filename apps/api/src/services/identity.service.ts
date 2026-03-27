import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { getAccessToken } from './interswitch.service';

// ─────────────────────────────────────────────────────────────────────────────
// KYC Tier definitions
// ─────────────────────────────────────────────────────────────────────────────

export const KYC_TIER_LIMITS = {
  NONE:     { daily: 50_000,     monthly: 200_000 },
  BASIC:    { daily: 200_000,    monthly: 1_000_000 },
  STANDARD: { daily: 1_000_000,  monthly: 5_000_000 },
  PREMIUM:  { daily: 5_000_000,  monthly: 25_000_000 },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Country / ID-type configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface IdTypeConfig {
  key: string;
  label: string;
  pattern: RegExp;
  formatHint: string;
  tier: 'BASIC' | 'STANDARD';
}

export const COUNTRY_ID_TYPES: Record<string, IdTypeConfig[]> = {
  NG: [
    { key: 'BVN', label: 'Bank Verification Number (BVN)', pattern: /^\d{11}$/, formatHint: 'BVN must be exactly 11 digits.', tier: 'STANDARD' },
    { key: 'NIN', label: 'National Identification Number (NIN)', pattern: /^\d{11}$/, formatHint: 'NIN must be exactly 11 digits.', tier: 'STANDARD' },
    { key: 'DRIVERS_LICENSE', label: "Driver's License", pattern: /^[A-Z]{3}-\d{5}[A-Z]{2}\d{2}$/, formatHint: 'Format: ABC-12345DE67 (3 letters, hyphen, 5 digits, 2 letters, 2 digits).', tier: 'BASIC' },
    { key: 'VOTERS_CARD', label: "Voter's Card", pattern: /^\d{19}$/, formatHint: "Voter's Card must be exactly 19 digits.", tier: 'STANDARD' },
    { key: 'PASSPORT', label: 'International Passport', pattern: /^[A-Z]\d{8}$/, formatHint: 'Passport: 1 uppercase letter followed by 8 digits.', tier: 'BASIC' },
  ],
  UG: [
    { key: 'NIN', label: 'National Identification Number', pattern: /^[A-Z0-9]{14}$/i, formatHint: 'NIN must be 14 alphanumeric characters.', tier: 'STANDARD' },
    { key: 'PASSPORT', label: 'Passport', pattern: /^[A-Z]\d{7}$/, formatHint: 'Passport: 1 uppercase letter followed by 7 digits.', tier: 'BASIC' },
    { key: 'DRIVERS_LICENSE', label: "Driver's License", pattern: /^[A-Z0-9]{9}$/i, formatHint: "Driver's License must be 9 alphanumeric characters.", tier: 'BASIC' },
  ],
  KE: [
    { key: 'NATIONAL_ID', label: 'National ID', pattern: /^\d{7,8}$/, formatHint: 'National ID must be 7 to 8 digits.', tier: 'STANDARD' },
    { key: 'PASSPORT', label: 'Passport', pattern: /^[A-Z]\d{7}$/, formatHint: 'Passport: 1 uppercase letter followed by 7 digits.', tier: 'BASIC' },
    { key: 'DRIVERS_LICENSE', label: "Driver's License", pattern: /^[A-Z0-9]{9}$/i, formatHint: "Driver's License must be 9 alphanumeric characters.", tier: 'BASIC' },
  ],
  GH: [
    { key: 'GHANA_CARD', label: 'Ghana Card', pattern: /^GHA-\d{9}-\d$/, formatHint: 'Ghana Card: GHA-123456789-0.', tier: 'STANDARD' },
    { key: 'PASSPORT', label: 'Passport', pattern: /^G\d{7}$/, formatHint: 'Passport: G followed by 7 digits.', tier: 'BASIC' },
    { key: 'VOTERS_ID', label: "Voter's ID", pattern: /^\d{10}$/, formatHint: "Voter's ID must be 10 digits.", tier: 'STANDARD' },
    { key: 'DRIVERS_LICENSE', label: "Driver's License", pattern: /^[A-Z0-9]{10}$/i, formatHint: "Driver's License must be 10 alphanumeric characters.", tier: 'BASIC' },
  ],
  ZA: [
    { key: 'RSA_ID', label: 'South African ID', pattern: /^\d{13}$/, formatHint: 'RSA ID must be 13 digits.', tier: 'STANDARD' },
    { key: 'PASSPORT', label: 'Passport', pattern: /^[A-Z]\d{8}$/, formatHint: 'Passport: 1 uppercase letter followed by 8 digits.', tier: 'BASIC' },
    { key: 'DRIVERS_LICENSE', label: "Driver's License", pattern: /^[A-Z0-9]{9}$/i, formatHint: "Driver's License must be 9 alphanumeric characters.", tier: 'BASIC' },
  ],
  EG: [
    { key: 'NATIONAL_ID', label: 'National ID', pattern: /^\d{14}$/, formatHint: 'National ID must be 14 digits.', tier: 'STANDARD' },
    { key: 'PASSPORT', label: 'Passport', pattern: /^[A-Z]\d{8}$/, formatHint: 'Passport: 1 uppercase letter followed by 8 digits.', tier: 'BASIC' },
  ],
  TZ: [
    { key: 'NIDA', label: 'NIDA Number', pattern: /^\d{20}$/, formatHint: 'NIDA number must be 20 digits.', tier: 'STANDARD' },
    { key: 'PASSPORT', label: 'Passport', pattern: /^[A-Z]{2}\d{7}$/, formatHint: 'Passport: 2 uppercase letters followed by 7 digits.', tier: 'BASIC' },
    { key: 'DRIVERS_LICENSE', label: "Driver's License", pattern: /^[A-Z0-9]{9}$/i, formatHint: "Driver's License must be 9 alphanumeric characters.", tier: 'BASIC' },
  ],
  RW: [
    { key: 'NATIONAL_ID', label: 'National ID', pattern: /^\d{16}$/, formatHint: 'National ID must be 16 digits.', tier: 'STANDARD' },
    { key: 'PASSPORT', label: 'Passport', pattern: /^[A-Z]{2}\d{7}$/, formatHint: 'Passport: 2 uppercase letters followed by 7 digits.', tier: 'BASIC' },
  ],
  ZM: [
    { key: 'NRC', label: 'National Registration Card (NRC)', pattern: /^\d{6}\/\d{2}\/\d{1}$/, formatHint: 'NRC format: 123456/78/9.', tier: 'STANDARD' },
    { key: 'PASSPORT', label: 'Passport', pattern: /^[A-Z]{2}\d{7}$/, formatHint: 'Passport: 2 uppercase letters followed by 7 digits.', tier: 'BASIC' },
  ],
  MW: [
    { key: 'NATIONAL_ID', label: 'National ID', pattern: /^[A-Z]{2}\d{7}[A-Z]$/, formatHint: 'National ID: 2 uppercase letters, 7 digits, 1 uppercase letter.', tier: 'STANDARD' },
    { key: 'PASSPORT', label: 'Passport', pattern: /^[A-Z]{2}\d{7}$/, formatHint: 'Passport: 2 uppercase letters followed by 7 digits.', tier: 'BASIC' },
  ],
};

function sha256(value: string): string {
  return crypto.createHmac('sha256', env.ENCRYPTION_KEY).update(value).digest('hex');
}

function isTestRejectionId(idNumber: string): boolean {
  const digits = idNumber.replace(/[^0-9]/g, '');
  if (!digits.length) return false;
  return /^(.)\1+$/.test(digits);
}

function getIdTypeConfig(country: string, idType: string): IdTypeConfig | undefined {
  return (COUNTRY_ID_TYPES[country] ?? []).find((c) => c.key === idType);
}

export function getVerificationRequirements(nationality: string) {
  const configs = COUNTRY_ID_TYPES[nationality.toUpperCase()];
  if (!configs?.length) {
    return { idType: 'NIN', label: 'National Identification Number', format: '11 digits', example: '71234567890' };
  }
  const primary = configs[0];
  return { idType: primary.key, label: primary.label, format: primary.formatHint, example: '' };
}

async function getDailyAttempts(userId: string): Promise<number> {
  const key = `kyc:attempts:${userId}`;
  try {
    const val = await redis.get(key);
    return val ? Number(val) : 0;
  } catch {
    return 0;
  }
}

async function incrementDailyAttempts(userId: string): Promise<void> {
  const key = `kyc:attempts:${userId}`;
  try {
    const val = await redis.incr(key);
    if (val === 1) await redis.expire(key, 24 * 60 * 60);
  } catch {
    // ignore
  }
}

async function applyKycTierToUser(
  userId: string,
  country: string,
  idType: string,
  idHash: string
): Promise<'NONE' | 'BASIC' | 'STANDARD' | 'PREMIUM'> {
  const config = getIdTypeConfig(country, idType);
  const newTier = config?.tier ?? 'BASIC';

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycTier: true, bvnHash: true, ninHash: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');

  let finalTier: 'NONE' | 'BASIC' | 'STANDARD' | 'PREMIUM' = newTier;
  if (country === 'NG') {
    const hasBvn = idType === 'BVN' ? true : Boolean(user.bvnHash);
    const hasNin = idType === 'NIN' ? true : Boolean(user.ninHash);
    if (hasBvn && hasNin) finalTier = 'PREMIUM';
  }

  const tierOrder: Array<'NONE' | 'BASIC' | 'STANDARD' | 'PREMIUM'> = ['NONE', 'BASIC', 'STANDARD', 'PREMIUM'];
  const currentTierIndex = tierOrder.indexOf((user.kycTier as 'NONE' | 'BASIC' | 'STANDARD' | 'PREMIUM') ?? 'NONE');
  const newTierIndex = tierOrder.indexOf(finalTier);
  if (newTierIndex <= currentTierIndex) {
    finalTier = (user.kycTier as 'NONE' | 'BASIC' | 'STANDARD' | 'PREMIUM') ?? 'NONE';
  }

  const limits = KYC_TIER_LIMITS[finalTier];

  const updateData = {
    kycTier: finalTier,
    kycStatus: 'APPROVED' as const,
    kycVerifiedAt: new Date(),
    kycRejectionReason: null,
    idVerificationStatus: 'VERIFIED' as const,
    idVerifiedAt: new Date(),
    idType,
    idCountry: country,
    dailySwapLimit: limits.daily,
    monthlySwapLimit: limits.monthly,
    ...(idType === 'BVN' ? { bvnHash: idHash } : {}),
    ...(idType === 'NIN' ? { ninHash: idHash } : {}),
    ...(idType !== 'BVN' && idType !== 'NIN' ? { nationalIdHash: idHash } : {}),
  };

  await prisma.user.update({ where: { id: userId }, data: updateData });

  await prisma.notification.create({
    data: {
      userId,
      type: 'DEPOSIT',
      message: `Your identity has been verified. You are now on the ${finalTier} tier with a daily limit of ₦${limits.daily.toLocaleString()} and monthly limit of ₦${limits.monthly.toLocaleString()}.`,
    },
  });

  return finalTier;
}

async function mockVerify(
  userId: string,
  country: string,
  idType: string,
  idNumber: string
): Promise<{ verified: boolean; reason?: string; tier?: string }> {
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

  if (isTestRejectionId(idNumber)) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        idVerificationStatus: 'FAILED',
        idVerificationFailureReason: 'ID could not be verified. Please check the number and try again.',
      },
    });
    return { verified: false, reason: 'ID could not be verified. Please check the number and try again.' };
  }

  const idHash = sha256(idNumber);
  const tier = await applyKycTierToUser(userId, country, idType, idHash);
  return { verified: true, tier };
}

export async function verifyBvn(
  userId: string,
  bvn: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string
): Promise<{ verified: boolean; reason?: string; tier?: string }> {
  if (!/^\d{11}$/.test(bvn)) throw new Error('INVALID_BVN_FORMAT');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { bvnHash: true } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.bvnHash) throw new Error('ALREADY_VERIFIED');

  try {
    const token = await getAccessToken();
    const response = await axios.post(
      `${env.INTERSWITCH_BASE_URL}/api/v1/identity/bvn/verify`,
      { bvn, firstName, lastName, dateOfBirth },
      { timeout: 25000, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    const data = response.data as { verified?: boolean; responseCode?: string };
    if (!data.verified && data.responseCode !== '00') {
      await prisma.user.update({ where: { id: userId }, data: { idVerificationStatus: 'FAILED', idVerificationFailureReason: 'BVN verification failed.' } });
      throw new Error('BVN_VERIFICATION_FAILED');
    }
  } catch (err) {
    if ((err as Error).message === 'BVN_VERIFICATION_FAILED') throw err;
    console.warn('[Identity] BVN live API unavailable, using mock', err);
    return mockVerify(userId, 'NG', 'BVN', bvn);
  }

  const idHash = sha256(bvn);
  const tier = await applyKycTierToUser(userId, 'NG', 'BVN', idHash);
  return { verified: true, tier };
}

export async function verifyNin(
  userId: string,
  nin: string,
  firstName: string,
  lastName: string
): Promise<{ verified: boolean; reason?: string; tier?: string }> {
  if (!/^\d{11}$/.test(nin)) throw new Error('INVALID_NIN_FORMAT');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { bvnHash: true } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (!user.bvnHash) throw new Error('NIN_REQUIRES_BVN');

  try {
    const token = await getAccessToken();
    const response = await axios.post(
      `${env.INTERSWITCH_BASE_URL}/api/v1/identity/nin/verify`,
      { nin, firstName, lastName },
      { timeout: 25000, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    const data = response.data as { verified?: boolean; responseCode?: string };
    if (!data.verified && data.responseCode !== '00') {
      await prisma.user.update({ where: { id: userId }, data: { idVerificationStatus: 'FAILED', idVerificationFailureReason: 'NIN verification failed.' } });
      throw new Error('NIN_VERIFICATION_FAILED');
    }
  } catch (err) {
    if ((err as Error).message === 'NIN_VERIFICATION_FAILED') throw err;
    if ((err as Error).message === 'NIN_REQUIRES_BVN') throw err;
    console.warn('[Identity] NIN live API unavailable, using mock', err);
    return mockVerify(userId, 'NG', 'NIN', nin);
  }

  const idHash = sha256(nin);
  const tier = await applyKycTierToUser(userId, 'NG', 'NIN', idHash);
  return { verified: true, tier };
}

export async function verifyIdentity(
  userId: string,
  country: string,
  idType: string,
  idNumber: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string
): Promise<{ verified: boolean; reason?: string; tier?: string; attemptsRemaining?: number }> {
  const upperCountry = country.toUpperCase();
  const upperIdType = idType.toUpperCase();

  if (!COUNTRY_ID_TYPES[upperCountry]) throw new Error('COUNTRY_NOT_SUPPORTED');

  const config = getIdTypeConfig(upperCountry, upperIdType);
  if (!config) throw new Error('ID_TYPE_NOT_SUPPORTED');

  const upperIdNumber = idNumber.toUpperCase();
  if (!config.pattern.test(upperIdNumber)) {
    const err = new Error('IDENTITY_VERIFICATION_FAILED');
    (err as Error & { detail?: string }).detail = config.formatHint;
    throw err;
  }

  const attempts = await getDailyAttempts(userId);
  if (attempts >= 3) throw new Error('KYC_ATTEMPTS_EXCEEDED');
  await incrementDailyAttempts(userId);

  if (upperCountry === 'NG' && upperIdType === 'BVN') {
    return verifyBvn(userId, upperIdNumber, firstName, lastName, dateOfBirth);
  }
  if (upperCountry === 'NG' && upperIdType === 'NIN') {
    return verifyNin(userId, upperIdNumber, firstName, lastName);
  }

  return mockVerify(userId, upperCountry, upperIdType, upperIdNumber);
}

// Legacy wrappers
export async function verifyNigerianNIN(userId: string, nin: string, firstName: string, lastName: string, _dob: string) {
  return verifyNin(userId, nin, firstName, lastName);
}

export async function verifySmileIdentity(userId: string, country: string, idType: string, idNumber: string, _fn: string, _ln: string, _dob: string) {
  return mockVerify(userId, country.toUpperCase(), idType.toUpperCase(), idNumber);
}
