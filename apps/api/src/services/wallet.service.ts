import Decimal from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { getRate } from './rates.service';
import { initiatePayment } from './interswitch.service';
import { env } from '../config/env';
import { verifyPinToken } from './pin.service';

const FEE_RATE = new Decimal('0.015'); // 1.5%

export async function getWallets(userId: string) {
  return prisma.wallet.findMany({
    where: { userId },
    orderBy: { currency: 'asc' },
  });
}

export async function fundWallet(
  userId: string,
  currency: string,
  amount: number,
  userEmail: string,
  userName: string
): Promise<{ paymentUrl: string; reference: string }> {
  const decimalAmount = new Decimal(amount);
  if (decimalAmount.lte(0)) throw new Error('INVALID_AMOUNT');

  const txRef = `AXP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  const amountInKobo = decimalAmount.mul(100).floor().toNumber();

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: 'DEPOSIT',
      status: 'PENDING',
      fromCurrency: currency,
      toCurrency: currency,
      fromAmount: decimalAmount,
      toAmount: decimalAmount,
      exchangeRate: new Decimal(1),
      fee: new Decimal(0),
      reference: txRef,
      narration: `Wallet funding — ${currency}`,
    },
  });

  const redirectUrl = 'https://axioslast-web.vercel.app/deposit/callback';

  const paymentUrl = await initiatePayment({
    txRef,
    amount: amountInKobo,
    currency,
    customerEmail: userEmail,
    customerName: userName,
    redirectUrl,
  });

  return { paymentUrl, reference: transaction.reference! };
}

export async function swapCurrency(
  userId: string,
  fromCurrency: string,
  toCurrency: string,
  fromAmount: number,
  pinToken?: string
): Promise<{
  transaction: object;
  fromAmount: string;
  toAmount: string;
  fee: string;
  rate: string;
}> {
  if (fromCurrency === toCurrency) throw new Error('SAME_CURRENCY');

  const decimalAmount = new Decimal(fromAmount);
  if (decimalAmount.lte(0)) throw new Error('INVALID_AMOUNT');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailySwapLimit: true,
      dailySwapUsed: true,
      dailyLimitResetAt: true,
    },
  });
  if (!user) throw new Error('USER_NOT_FOUND');

  await verifyPinToken(userId, pinToken);

  let dailySwapUsed = new Decimal(user.dailySwapUsed.toString());
  const now = new Date();
  if (user.dailyLimitResetAt <= now) {
    dailySwapUsed = new Decimal(0);
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailySwapUsed: 0,
        dailyLimitResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });
  }

  const dailySwapLimit = new Decimal(user.dailySwapLimit.toString());
  if (dailySwapUsed.add(decimalAmount).gt(dailySwapLimit)) {
    throw new Error('DAILY_LIMIT_EXCEEDED');
  }

  const sourceWallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency: fromCurrency } },
  });

  if (!sourceWallet) throw new Error('WALLET_NOT_FOUND');

  const balance = new Decimal(sourceWallet.balance.toString());
  if (balance.lt(decimalAmount)) throw new Error('INSUFFICIENT_BALANCE');

  const rate = await getRate(fromCurrency, toCurrency);
  const fee = decimalAmount.mul(FEE_RATE).toDecimalPlaces(2, Decimal.ROUND_UP);
  const netAmount = decimalAmount.minus(fee);
  const toAmount = netAmount.mul(rate).toDecimalPlaces(2, Decimal.ROUND_DOWN);

  const txRef = `AXP-SWP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.wallet.update({
      where: { userId_currency: { userId, currency: fromCurrency } },
      data: { balance: { decrement: decimalAmount.toNumber() } },
    });

    await tx.wallet.upsert({
      where: { userId_currency: { userId, currency: toCurrency } },
      create: { userId, currency: toCurrency, balance: toAmount.toNumber() },
      update: { balance: { increment: toAmount.toNumber() } },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        type: 'SWAP',
        status: 'COMPLETED',
        fromCurrency,
        toCurrency,
        fromAmount: decimalAmount,
        toAmount,
        exchangeRate: rate,
        fee,
        reference: txRef,
        narration: `Swap ${fromCurrency} → ${toCurrency}`,
      },
      });

      await tx.user.update({
        where: { id: userId },
        data: { dailySwapUsed: { increment: decimalAmount.toNumber() } },
      });

      return transaction;
    });

  return {
    transaction: result,
    fromAmount: decimalAmount.toString(),
    toAmount: toAmount.toString(),
    fee: fee.toString(),
    rate: rate.toString(),
  };
}

export async function getTransactions(
  userId: string,
  page: number = 1,
  limit: number = 20,
  type?: string
) {
  const skip = (page - 1) * limit;

  const where: { userId: string; type?: 'DEPOSIT' | 'SWAP' | 'WITHDRAWAL' } = { userId };
  if (type && ['DEPOSIT', 'SWAP', 'WITHDRAWAL'].includes(type)) {
    where.type = type as 'DEPOSIT' | 'SWAP' | 'WITHDRAWAL';
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getTransaction(userId: string, transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction || transaction.userId !== userId) {
    throw new Error('TRANSACTION_NOT_FOUND');
  }

  return transaction;
}

export async function completeDeposit(reference: string): Promise<void> {
  const transaction = await prisma.transaction.findUnique({
    where: { reference },
  });

  if (!transaction || transaction.status !== 'PENDING' || transaction.type !== 'DEPOSIT') {
    return;
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.transaction.update({
      where: { reference },
      data: { status: 'COMPLETED' },
    });

    await tx.wallet.upsert({
      where: {
        userId_currency: {
          userId: transaction.userId,
          currency: transaction.toCurrency,
        },
      },
      create: {
        userId: transaction.userId,
        currency: transaction.toCurrency,
        balance: transaction.toAmount,
      },
      update: {
        balance: { increment: Number(transaction.toAmount) },
      },
    });
  });
}
