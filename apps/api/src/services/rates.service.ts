import { prisma } from '../config/prisma';
import Decimal from 'decimal.js';

const SUPPORTED_PAIRS: Record<string, Record<string, number>> = {
  NGN: { UGX: 10.85, KES: 0.29, GHS: 0.021, ZAR: 0.052, NGN: 1 },
  UGX: { NGN: 0.092, KES: 0.027, GHS: 0.00194, ZAR: 0.0048, UGX: 1 },
  KES: { NGN: 3.45, UGX: 37.1, GHS: 0.072, ZAR: 0.178, KES: 1 },
  GHS: { NGN: 47.6, UGX: 515, KES: 13.9, ZAR: 2.47, GHS: 1 },
  ZAR: { NGN: 19.2, UGX: 208, KES: 5.62, GHS: 0.405, ZAR: 1 },
};

export async function getRate(from: string, to: string): Promise<Decimal> {
  if (from === to) return new Decimal(1);

  const supported = SUPPORTED_PAIRS[from]?.[to];
  if (supported === undefined) {
    throw new Error('UNSUPPORTED_PAIR');
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const cached = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: from,
      toCurrency: to,
      fetchedAt: { gte: twoHoursAgo },
    },
    orderBy: { fetchedAt: 'desc' },
  });

  if (cached) {
    return new Decimal(cached.rate.toString());
  }

  const rate = await prisma.exchangeRate.create({
    data: {
      fromCurrency: from,
      toCurrency: to,
      rate: new Decimal(supported),
      source: 'seed',
    },
  });

  return new Decimal(rate.rate.toString());
}

export async function getAllRates(): Promise<Array<{ from: string; to: string; rate: string }>> {
  const rates: Array<{ from: string; to: string; rate: string }> = [];

  const corridors: Array<[string, string]> = [
    ['NGN', 'UGX'], ['NGN', 'KES'], ['NGN', 'GHS'], ['NGN', 'ZAR'],
    ['UGX', 'KES'], ['UGX', 'GHS'], ['UGX', 'ZAR'],
    ['KES', 'GHS'], ['KES', 'ZAR'],
    ['GHS', 'ZAR'],
  ];

  for (const [from, to] of corridors) {
    const rate = await getRate(from, to);
    rates.push({ from, to, rate: rate.toString() });
  }

  return rates;
}
