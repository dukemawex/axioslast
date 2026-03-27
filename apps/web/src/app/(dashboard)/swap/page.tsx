'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { SwapWidget } from '@/components/ui/SwapWidget';
import { getCurrencyDisplay } from '@/lib/currencies';
import { useRates } from '@/hooks/useRates';
import { useAuthStore } from '@/store/authStore';

interface SwapResult {
  fromAmount: string;
  fromCurrency: string;
  toAmount: string;
  toCurrency: string;
}

export default function SwapPage() {
  const [success, setSuccess] = useState<SwapResult | null>(null);
  const queryClient = useQueryClient();
  const { rates } = useRates();
  const { user } = useAuthStore();

  const oldestAge = rates.length ? Math.max(...rates.map((rate) => rate.ageSeconds)) : Number.POSITIVE_INFINITY;
  const hasFallbackRate = rates.some((rate) => rate.provider === 'database-fallback');

  const freshness = hasFallbackRate
    ? { dot: 'bg-red-500', label: 'Using last known rate' }
    : oldestAge < 600
      ? { dot: 'bg-green-500', label: 'Live rate' }
      : { dot: 'bg-amber-500', label: 'Rate may be stale' };

  function handleSwap(result: unknown) {
    const r = result as SwapResult;
    setSuccess(r);
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  }

  return (
    <div className="max-w-lg w-full">
      <h1 className="font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-text-primary mb-6">Currency Swap</h1>
      <div className="mb-4 inline-flex items-center gap-2 text-sm text-text-secondary">
        <span className={`w-2.5 h-2.5 rounded-full ${freshness.dot}`} />
        <span>{freshness.label}</span>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-card">
          <p className="text-success font-semibold">✅ Swap successful!</p>
          <p className="text-sm text-text-secondary mt-1">
            {success.fromAmount} {getCurrencyDisplay(success.fromCurrency)} → {success.toAmount} {getCurrencyDisplay(success.toCurrency)}
          </p>
          <button onClick={() => setSuccess(null)} className="text-sm text-text-muted hover:text-text-primary mt-2">
            Make another swap
          </button>
        </div>
      )}
      {user?.idVerificationStatus !== 'VERIFIED' && (
        <div className="mb-4 p-3 rounded-btn border border-amber-300 bg-amber-50 text-sm text-amber-900">
          You&apos;ve reached your daily limit. Verify your identity to increase your limit to 500,000 NGN/day.{' '}
          <a href="/profile/kyc" className="underline font-medium">Verify Now →</a>
        </div>
      )}

      <Card>
        <SwapWidget onSwap={handleSwap} mobileStickyAction />
      </Card>
    </div>
  );
}
