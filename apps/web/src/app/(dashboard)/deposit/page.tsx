'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const schema = z.object({
  amount: z.coerce.number().positive().min(100, 'Minimum deposit is ₦100'),
});

type FormData = z.infer<typeof schema>;

type Tab = 'card' | 'bank' | 'ussd';

export default function DepositPage() {
  const [tab, setTab] = useState<Tab>('card');
  const [cardLoading, setCardLoading] = useState(false);
  const [ussdLoading, setUssdLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [ussdCode, setUssdCode] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 100 },
  });

  const {
    register: registerUssd,
    handleSubmit: handleUssdSubmit,
    formState: { errors: ussdErrors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 100 },
  });

  const amount = watch('amount') || 0;
  const fee = useMemo(() => (amount > 0 ? amount * 0.015 : 0), [amount]);
  const total = useMemo(() => amount + fee, [amount, fee]);

  const virtualAccountNumber = '1022334455';
  const virtualBankName = 'Interswitch Virtual Bank';
  const merchantCode = process.env.NEXT_PUBLIC_INTERSWITCH_MERCHANT_CODE || 'MERCHANT_CODE';

  useEffect(() => {
    if (tab !== 'bank') {
      return;
    }
    const timer = window.setInterval(() => {
      api.wallets.getTransactions({ page: 1, limit: 20, type: 'DEPOSIT' }).catch(() => {});
    }, 30000);

    return () => window.clearInterval(timer);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'ussd') {
      return;
    }
    const timer = window.setInterval(() => {
      api.wallets.getTransactions({ page: 1, limit: 20, type: 'DEPOSIT' }).catch(() => {});
    }, 30000);

    return () => window.clearInterval(timer);
  }, [tab]);

  async function copyText(value: string, successMessage: string) {
    await navigator.clipboard.writeText(value);
    setCopyMessage(successMessage);
    window.setTimeout(() => setCopyMessage(''), 2000);
  }

  async function initiateDeposit(amountToPay: number): Promise<{ paymentUrl: string; reference: string }> {
    const result = await api.wallets.initiateDeposit({ amount: amountToPay });
    const paymentUrl = result.data?.paymentUrl as string | undefined;
    const reference = result.data?.reference as string | undefined;

    if (!paymentUrl || !reference) {
      throw new Error('Payment link unavailable. Please try again.');
    }

    return { paymentUrl, reference };
  }

  async function onCardSubmit(data: FormData) {
    setCardLoading(true);
    setError('');
    try {
      const { paymentUrl } = await initiateDeposit(data.amount);
      window.location.href = paymentUrl;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Failed to initiate payment.');
    } finally {
      setCardLoading(false);
    }
  }

  async function onGenerateUssd(data: FormData) {
    setUssdLoading(true);
    setError('');
    try {
      const result = await api.wallets.initiateDeposit({ amount: data.amount });
      const reference = result.data?.reference as string | undefined;
      if (!reference) {
        setError('Unable to generate USSD code. Please try again.');
        return;
      }

      setUssdCode(`*322*${merchantCode}*${Math.round(data.amount)}*${reference}#`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Failed to generate USSD code.');
    } finally {
      setUssdLoading(false);
    }
  }

  return (
    <div className="max-w-lg w-full">
      <h1 className="font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-text-primary mb-6">Deposit</h1>

      {/* Interswitch Sandbox Test Card:
      Card Number: 5061460410120223210
      Expiry: 12/31
      CVV: 780
      PIN: 1111
      OTP: 123456 */}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[
          { label: 'Pay with Card', value: 'card' as const },
          { label: 'Bank Transfer', value: 'bank' as const },
          { label: 'USSD', value: 'ussd' as const },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={`px-4 py-2 min-h-11 rounded-full text-sm whitespace-nowrap transition-all duration-200 ${
              tab === item.value
                ? 'bg-brand-amber text-white'
                : 'bg-subtle text-text-secondary hover:bg-border'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {copyMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-btn text-sm text-success">
          {copyMessage}
        </div>
      )}

      {tab === 'card' && (
        <Card>
          <form onSubmit={handleSubmit(onCardSubmit)} className="space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-btn text-sm text-error">{error}</div>}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">₦</span>
                <input
                  type="number"
                  min="100"
                  placeholder="1000"
                  className={`w-full pl-8 pr-3 py-2.5 rounded-btn border text-text-primary placeholder-text-muted bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber focus:border-transparent transition-colors ${
                    errors.amount?.message ? 'border-error' : 'border-border'
                  }`}
                  {...register('amount')}
                />
              </div>
              {errors.amount?.message && <p className="text-sm text-error">{errors.amount.message}</p>}
            </div>

            <p className="text-xs text-text-muted">Minimum amount: ₦100</p>

            {amount >= 100 && (
              <div className="bg-brand-bg rounded-btn p-3 text-sm space-y-1">
                <p className="text-text-secondary">Fee: 1.5% = ₦{fee.toFixed(2)}</p>
                <p className="text-text-primary font-medium">You will be charged ₦{total.toFixed(2)}</p>
              </div>
            )}

            <Button type="submit" loading={cardLoading} className="w-full">
              Pay with Card
            </Button>
          </form>
        </Card>
      )}

      {tab === 'bank' && (
        <Card className="space-y-4">
          <div className="bg-brand-bg rounded-btn p-3">
            <p className="text-sm text-text-secondary">Dedicated virtual account</p>
            <p className="text-lg font-semibold text-text-primary mt-1">{virtualAccountNumber}</p>
            <p className="text-sm text-text-secondary">{virtualBankName}</p>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => copyText(virtualAccountNumber, 'Account number copied')}
          >
            <Copy className="w-4 h-4" />
            Copy Account Number
          </Button>

          <div className="text-sm text-text-secondary space-y-2">
            <p>1. Open your banking app or USSD banking.</p>
            <p>2. Transfer to the virtual account above.</p>
            <p>3. Your wallet updates automatically once payment is confirmed.</p>
            <p className="text-xs text-text-muted">Checking for new deposits every 30 seconds.</p>
          </div>
        </Card>
      )}

      {tab === 'ussd' && (
        <Card>
          <form onSubmit={handleUssdSubmit(onGenerateUssd)} className="space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-btn text-sm text-error">{error}</div>}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">₦</span>
                <input
                  type="number"
                  min="100"
                  placeholder="1000"
                  className={`w-full pl-8 pr-3 py-2.5 rounded-btn border text-text-primary placeholder-text-muted bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber focus:border-transparent transition-colors ${
                    ussdErrors.amount?.message ? 'border-error' : 'border-border'
                  }`}
                  {...registerUssd('amount')}
                />
              </div>
              {ussdErrors.amount?.message && <p className="text-sm text-error">{ussdErrors.amount.message}</p>}
            </div>

            <Button type="submit" loading={ussdLoading} className="w-full">
              Generate Code
            </Button>

            {ussdCode && (
              <div className="bg-brand-bg rounded-btn p-3 text-sm space-y-3">
                <p className="text-text-secondary">Dial this code to pay:</p>
                <p className="font-mono text-text-primary break-all">{ussdCode}</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => copyText(ussdCode, 'USSD code copied')}
                >
                  <Copy className="w-4 h-4" />
                  Copy Code
                </Button>
              </div>
            )}

            <p className="text-xs text-text-muted">
              We check for confirmed USSD deposits every 30 seconds.
            </p>
          </form>
        </Card>
      )}
    </div>
  );
}
