'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleCheckBig, CircleX, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type DepositStatus = 'PAID' | 'PENDING' | 'FAILED';

interface VerifyResponse {
  status: DepositStatus;
  amount: string;
  currency: string;
  createdAt: string;
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const txnRef = searchParams.get('txnref') || '';

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<DepositStatus>('PENDING');
  const [amount, setAmount] = useState<string>('0.00');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const redirectTimerRef = useRef<number | null>(null);

  const verifyTransaction = useCallback(async () => {
    if (!txnRef) {
      setStatus('FAILED');
      setError('Missing transaction reference.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.wallets.verifyDeposit(txnRef);
      const data = response.data as VerifyResponse;
      setStatus(data.status);
      setAmount(data.amount);
      return data;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Unable to verify payment at the moment.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [txnRef]);

  useEffect(() => {
    verifyTransaction();
  }, [verifyTransaction]);

  useEffect(() => {
    if (status !== 'PENDING' || attempts >= 3 || !txnRef) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setAttempts((prev) => prev + 1);
      await verifyTransaction();
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [attempts, status, txnRef, verifyTransaction]);

  useEffect(() => {
    if (status === 'PAID') {
      redirectTimerRef.current = window.setTimeout(() => {
        router.push('/wallet');
      }, 3000);
    }

    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, [router, status]);

  const content = useMemo(() => {
    if (status === 'PAID') {
      return {
        icon: <CircleCheckBig className="w-12 h-12 text-success" />,
        title: `₦${amount} deposited successfully`,
        description: 'Redirecting you to your wallet...',
        cardClass: 'border-green-200 bg-green-50',
      };
    }

    if (status === 'FAILED') {
      return {
        icon: <CircleX className="w-12 h-12 text-error" />,
        title: 'Payment was not completed',
        description: error || 'Please try again from the deposit page.',
        cardClass: 'border-red-200 bg-red-50',
      };
    }

    return {
      icon: loading ? <Loader2 className="w-12 h-12 text-brand-amber animate-spin" /> : <Loader2 className="w-12 h-12 text-brand-amber" />,
      title: 'Payment processing...',
      description: 'We are confirming your transaction with Interswitch.',
      cardClass: 'border-amber-200 bg-amber-50',
    };
  }, [amount, error, loading, status]);

  return (
    <div className="max-w-md mx-auto py-12">
      <Card className={`text-center space-y-4 ${content.cardClass}`}>
        <div className="flex justify-center">{content.icon}</div>
        <h1 className="text-xl font-semibold text-text-primary">{content.title}</h1>
        <p className="text-sm text-text-secondary">{content.description}</p>
        <p className="text-xs text-text-muted break-all">Reference: {txnRef || 'N/A'}</p>

        {status === 'PENDING' && (
          <Button type="button" variant="ghost" className="w-full" onClick={() => verifyTransaction()}>
            Retry
          </Button>
        )}

        {status === 'FAILED' && (
          <Button type="button" className="w-full" onClick={() => router.push('/deposit')}>
            Try Again
          </Button>
        )}
      </Card>
    </div>
  );
}

export default function DepositCallbackPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16 text-text-muted text-sm">Loading payment status...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
