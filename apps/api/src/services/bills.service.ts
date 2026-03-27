import Decimal from 'decimal.js';
import { prisma } from '../config/prisma';
import { verifyPinToken } from './pin.service';

const NETWORK_CODES: Record<string, string> = {
  MTN: 'mtn',
  AIRTEL: 'airtel',
  GLO: 'glo',
  '9MOBILE': '9mobile',
};

export async function rechargeAirtime(
  userId: string,
  phoneNumber: string,
  amountValue: number,
  network: string,
  pinToken?: string
) {
  const normalizedNetwork = network.toUpperCase();
  if (!NETWORK_CODES[normalizedNetwork]) throw new Error('INVALID_NETWORK');
  if (!/^\d{10,15}$/.test(phoneNumber)) throw new Error('INVALID_PHONE_NUMBER');

  const amount = new Decimal(amountValue);
  if (amount.lt(50) || amount.gt(50000)) throw new Error('INVALID_AMOUNT');
  await verifyPinToken(userId, pinToken);

  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency: 'NGN' } },
  });
  if (!wallet || new Decimal(wallet.balance.toString()).lt(amount)) {
    throw new Error('INSUFFICIENT_BALANCE');
  }

  const reference = `AXP-BILL-AT-${Date.now()}`;
  await prisma.$transaction(async (db) => {
    await db.wallet.update({
      where: { userId_currency: { userId, currency: 'NGN' } },
      data: { balance: { decrement: amount.toNumber() } },
    });
    await db.transaction.create({
      data: {
        userId,
        type: 'BILL_PAYMENT',
        status: 'COMPLETED',
        fromCurrency: 'NGN',
        toCurrency: 'NGN',
        fromAmount: amount,
        toAmount: amount,
        exchangeRate: new Decimal(1),
        fee: new Decimal(0),
        reference,
        narration: `Airtime recharge (${normalizedNetwork})`,
        metadata: { phoneNumber, network: normalizedNetwork },
      },
    });
    await db.notification.create({
      data: {
        userId,
        type: 'BILL_PAYMENT',
        message: `Airtime of ₦${amount.toFixed(2)} sent to ${phoneNumber}`,
        metadata: { phoneNumber, network: normalizedNetwork, reference },
      },
    });
  });

  return { reference, status: 'SUCCESS' as const };
}

export function getBillCategories() {
  return [
    { id: 'electricity', name: 'Electricity' },
    { id: 'cable_tv', name: 'Cable TV' },
    { id: 'water', name: 'Water' },
    { id: 'internet', name: 'Internet' },
  ];
}

export async function getBillers(categoryId: string) {
  const map: Record<string, Array<{ id: string; name: string }>> = {
    electricity: [
      { id: 'ikedc', name: 'Ikeja Electric' },
      { id: 'ekedc', name: 'Eko Electric' },
    ],
    cable_tv: [
      { id: 'dstv', name: 'DStv' },
      { id: 'gotv', name: 'GOtv' },
    ],
    water: [{ id: 'lagos_water', name: 'Lagos Water Corporation' }],
    internet: [
      { id: 'spectranet', name: 'Spectranet' },
      { id: 'smile', name: 'Smile Communications' },
    ],
  };
  return map[categoryId] || [];
}

export async function validateCustomer(billerId: string, customerId: string) {
  if (!billerId || !customerId) throw new Error('INVALID_PARAMETERS');
  return { customerName: `Validated ${customerId}` };
}

export async function payBill(
  userId: string,
  params: {
    categoryId: string;
    billerId: string;
    customerId: string;
    amount: number;
  },
  pinToken?: string
) {
  const amount = new Decimal(params.amount);
  if (amount.lte(0)) throw new Error('INVALID_AMOUNT');
  await verifyPinToken(userId, pinToken);

  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency: 'NGN' } },
  });
  if (!wallet || new Decimal(wallet.balance.toString()).lt(amount)) {
    throw new Error('INSUFFICIENT_BALANCE');
  }

  const reference = `AXP-BILL-${Date.now()}`;
  await prisma.$transaction(async (db) => {
    await db.wallet.update({
      where: { userId_currency: { userId, currency: 'NGN' } },
      data: { balance: { decrement: amount.toNumber() } },
    });
    await db.transaction.create({
      data: {
        userId,
        type: 'BILL_PAYMENT',
        status: 'COMPLETED',
        fromCurrency: 'NGN',
        toCurrency: 'NGN',
        fromAmount: amount,
        toAmount: amount,
        exchangeRate: new Decimal(1),
        fee: new Decimal(0),
        reference,
        narration: `Bill payment (${params.billerId})`,
        metadata: {
          categoryId: params.categoryId,
          billerId: params.billerId,
          customerId: params.customerId,
        },
      },
    });
    await db.notification.create({
      data: {
        userId,
        type: 'BILL_PAYMENT',
        message: `Bill payment of ₦${amount.toFixed(2)} successful`,
        metadata: { reference, ...params },
      },
    });
  });

  return { reference, status: 'SUCCESS' as const };
}
