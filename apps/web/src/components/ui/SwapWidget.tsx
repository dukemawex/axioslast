'use client';
import { useState, useEffect } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import Decimal from 'decimal.js';
import { api } from '@/lib/api';
import { CURRENCY_META, CurrencyCode, getCurrencyDisplay } from '@/lib/currencies';
import { Button } from './Button';
import { PINVerifyModal } from '@/components/PINVerifyModal';

const CURRENCIES = Object.keys(CURRENCY_META) as CurrencyCode[];

interface SwapWidgetProps {
  onSwap?: (result: unknown) => void;
  compact?: boolean;
}

export function SwapWidget({ onSwap, compact }: SwapWidgetProps) {
  const [fromCurrency, setFromCurrency] = useState('NGN');
  const [toCurrency, setToCurrency] = useState('UGX');
  const [fromAmount, setFromAmount] = useState('');
  const [rate, setRate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingSwap, setPendingSwap] = useState(false);

  const fee = fromAmount ? new Decimal(fromAmount || 0).mul('0.015').toFixed(2) : '0.00';
  const net = fromAmount ? new Decimal(fromAmount || 0).minus(fee).toFixed(2) : '0.00';
  const toAmount = rate && fromAmount ? new Decimal(net).mul(rate).toFixed(2) : '0.00';

  useEffect(() => {
    if (fromCurrency === toCurrency) return;
    setLoading(true);
    api.rates.getRate(fromCurrency, toCurrency)
      .then((r) => setRate(r.data.rate))
      .catch(() => setRate(null))
      .finally(() => setLoading(false));
  }, [fromCurrency, toCurrency]);

  async function executeSwap(pinToken: string) {
    if (!fromAmount || !rate) return;
    setSwapping(true);
    try {
      const result = await api.wallets.swap({
        fromCurrency,
        toCurrency,
        fromAmount: parseFloat(fromAmount),
      }, pinToken);
      onSwap?.(result.data);
    } finally {
      setSwapping(false);
      setPendingSwap(false);
      setPinModalOpen(false);
    }
  }

  async function handleSwap() {
    if (!fromAmount || !rate) return;
    setPendingSwap(true);
    setPinModalOpen(true);
  }

  function flip() {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }

  return (
    <div className={`space-y-4 ${compact ? '' : 'bg-surface rounded-card border border-border p-6'}`}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">You send</label>
          <div className="flex gap-2 mt-1">
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              className="border border-border rounded-btn px-3 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{getCurrencyDisplay(c)}</option>
              ))}
            </select>
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 border border-border rounded-btn px-3 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber font-mono"
            />
          </div>
        </div>

        <button onClick={flip} className="w-full flex justify-center text-text-muted hover:text-brand-amber transition-colors">
          <ArrowLeftRight className="w-5 h-5" />
        </button>

        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">You receive</label>
          <div className="flex gap-2 mt-1">
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              className="border border-border rounded-btn px-3 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{getCurrencyDisplay(c)}</option>
              ))}
            </select>
            <div className="flex-1 border border-border rounded-btn px-3 py-2.5 text-sm bg-subtle font-mono text-text-primary">
              {toAmount}
            </div>
          </div>
        </div>
      </div>

      {fromAmount && rate && (
        <div className="bg-brand-bg rounded-btn p-3 text-sm space-y-1">
          <div className="flex justify-between text-text-secondary">
            <span>Rate</span>
            <span className="font-mono">{loading ? '...' : `1 ${getCurrencyDisplay(fromCurrency)} = ${rate} ${getCurrencyDisplay(toCurrency)}`}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Axios Pay fee (1.5%)</span>
            <span className="font-mono">{fee} {getCurrencyDisplay(fromCurrency)}</span>
          </div>
          <div className="flex justify-between font-semibold text-text-primary border-t border-border pt-1 mt-1">
            <span>You receive</span>
            <span className="font-mono">{toAmount} {getCurrencyDisplay(toCurrency)}</span>
          </div>
        </div>
      )}

      <Button
        onClick={handleSwap}
        loading={swapping}
        disabled={!fromAmount || !rate || fromCurrency === toCurrency}
        className="w-full"
      >
        Swap Now
      </Button>

      <PINVerifyModal
        open={pinModalOpen}
        onClose={() => {
          if (!swapping) {
            setPinModalOpen(false);
            setPendingSwap(false);
          }
        }}
        onVerified={(pinToken) => {
          if (pendingSwap) {
            executeSwap(pinToken);
          }
        }}
      />
    </div>
  );
}
