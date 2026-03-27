import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { sendIdentityVerificationSuccessEmail } from './email.service';

type Nationality = 'NG' | 'UG' | 'KE' | 'GH' | 'ZA';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizedName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

function namesMatch(expectedFirst: string, expectedLast: string, providerFullName: string): boolean {
  const expected = `${normalizedName(expectedFirst)} ${normalizedName(expectedLast)}`.trim();
  const provider = normalizedName(providerFullName);
  if (!expected || !provider) return false;
  if (provider === expected) return true;
  const expectedParts = expected.split(' ');
  const providerParts = provider.split(' ');
  return expectedParts.every((part) => providerParts.includes(part));
}

function validateSouthAfricanId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  const digits = id.split('').map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8] + digits[10];
  const evenConcat = `${digits[1]}${digits[3]}${digits[5]}${digits[7]}${digits[9]}${digits[11]}`;
  const evenDoubled = (Number(evenConcat) * 2).toString();
  const evenSum = evenDoubled.split('').reduce((sum, n) => sum + Number(n), 0);
  const total = oddSum + evenSum;
  const checkDigit = (10 - (total % 10)) % 10;
  return checkDigit === digits[12];
}

function validateNationalId(country: Exclude<Nationality, 'NG'>, idNumber: string): void {
  if (country === 'UG' && !/^[A-Za-z0-9]{14}$/.test(idNumber)) throw new Error('INVALID_NATIONAL_ID');
  if (country === 'KE' && !/^\d{8}$/.test(idNumber)) throw new Error('INVALID_NATIONAL_ID');
  if (country === 'GH' && !/^GHA-\d{9}-\d$/.test(idNumber)) throw new Error('INVALID_NATIONAL_ID');
  if (country === 'ZA' && !validateSouthAfricanId(idNumber)) throw new Error('INVALID_NATIONAL_ID');
}

export function getVerificationRequirements(nationality: string) {
  const map: Record<string, { idType: string; label: string; format: string; example: string }> = {
    NG: { idType: 'NIN', label: 'National Identification Number', format: '11 digits', example: '71234567890' },
    UG: { idType: 'National ID', label: 'Ndaga Muntu National ID', format: '14 characters', example: 'CM86000XXXXXX' },
    KE: { idType: 'National ID', label: 'Kenyan National ID', format: '8 digits', example: '12345678' },
    GH: { idType: 'Ghana Card', label: 'Ghana Card Number', format: 'GHA-XXXXXXXXX-X', example: 'GHA-123456789-0' },
    ZA: { idType: 'SA ID', label: 'South African ID Number', format: '13 digits', example: '9001015009087' },
  };
  return map[nationality] ?? map.NG;
}

async function markVerified(
  userId: string,
  provider: 'dojah' | 'smile_identity',
  ref: string,
  updates: { ninHash?: string; nationalIdHash?: string }
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ninNumber: updates.ninHash,
      nationalIdNumber: updates.nationalIdHash,
      idVerificationStatus: 'VERIFIED',
      idVerificationProvider: provider,
      idVerificationRef: ref,
      idVerifiedAt: new Date(),
      idVerificationFailureReason: null,
      kycStatus: 'APPROVED',
      dailySwapLimit: 500000,
    },
    select: { email: true, firstName: true },
  });
  await sendIdentityVerificationSuccessEmail(user.email, user.firstName).catch(() => {});
}

async function markFailed(userId: string, reason: string, provider?: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      idVerificationStatus: 'FAILED',
      idVerificationFailureReason: reason,
      idVerificationProvider: provider ?? null,
    },
  });
}

export async function verifyNigerianNIN(
  userId: string,
  nin: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string
) {
  if (!/^\d{11}$/.test(nin)) throw new Error('INVALID_NIN');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { idVerificationStatus: true, firstName: true, lastName: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.idVerificationStatus === 'VERIFIED') throw new Error('ID_ALREADY_VERIFIED');

  const profileName = `${user.firstName} ${user.lastName}`.trim();
  const submittedName = `${firstName} ${lastName}`.trim();
  if (!namesMatch(firstName, lastName, profileName) || !namesMatch(user.firstName, user.lastName, submittedName)) {
    await markFailed(userId, 'Name does not match NIN records', 'dojah');
    return { verified: false, reason: 'Name does not match NIN records' };
  }

  const ref = `mock-dojah-${Date.now()}`;
  await markVerified(userId, 'dojah', ref, { ninHash: sha256(nin) });
  return {
    verified: true,
    provider: 'dojah',
    reference: ref,
    data: {
      firstName,
      lastName,
      address: 'Mock verified address',
      dateOfBirth,
    },
  };
}

export async function verifySmileIdentity(
  userId: string,
  country: Exclude<Nationality, 'NG'>,
  idType: string,
  idNumber: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string
) {
  validateNationalId(country, idNumber);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { idVerificationStatus: true, firstName: true, lastName: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.idVerificationStatus === 'VERIFIED') throw new Error('ID_ALREADY_VERIFIED');

  const profileName = `${user.firstName} ${user.lastName}`.trim();
  const submittedName = `${firstName} ${lastName}`.trim();
  if (!namesMatch(firstName, lastName, profileName) || !namesMatch(user.firstName, user.lastName, submittedName)) {
    await markFailed(userId, 'ID details do not match records', 'smile_identity');
    return { verified: false, reason: 'ID details do not match records' };
  }

  const ref = `mock-smile-${Date.now()}`;
  await markVerified(userId, 'smile_identity', ref, { nationalIdHash: sha256(idNumber) });
  return {
    verified: true,
    provider: 'smile_identity',
    reference: ref,
    data: { country, idType, dateOfBirth },
  };
}

export async function verifyIdentity(
  userId: string,
  nationality: string,
  idNumber: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string
) {
  const country = nationality.toUpperCase() as Nationality;
  if (country === 'NG') return verifyNigerianNIN(userId, idNumber, firstName, lastName, dateOfBirth);
  if (country === 'UG' || country === 'KE' || country === 'GH' || country === 'ZA') {
    return verifySmileIdentity(userId, country, 'NATIONAL_ID', idNumber, firstName, lastName, dateOfBirth);
  }
  throw new Error('INVALID_NATIONAL_ID');
}
