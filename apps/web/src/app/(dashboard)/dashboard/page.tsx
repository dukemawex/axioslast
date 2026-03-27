'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { WalletCard } from '@/components/ui/WalletCard';
import { TransactionRow } from '@/components/ui/TransactionRow';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { RatesGrid } from '@/components/ui/RatesGrid';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Wallet {
  id: string;
  currency: string;
  balance: string;
}

interface Transaction {
  id: string;
  type: string;
  status: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string | number;
  toAmount: string | number;
  narration?: string;
  createdAt: string;
}

const MIN_FUND_AMOUNT = 0.01;
const MOCK_WALLET_ID = 'mock-wallet';
const DEFAULT_CURRENCY_BY_NATIONALITY: Record<string, string> = {
  NG: 'NGN',
  UG: 'UGX',
  KE: 'KES',
  GH: 'GHS',
  ZA: 'ZAR',
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [showFundForm, setShowFundForm] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundFeedback, setFundFeedback] = useState('');
  const [mockFundedTotal, setMockFundedTotal] = useState(0);

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => api.wallets.getAll().then(r => r.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', 1],
    queryFn: () => api.wallets.getTransactions({ page: 1, limit: 5 }).then(r => r.data),
  });

  const fallbackCurrency = DEFAULT_CURRENCY_BY_NATIONALITY[(user?.nationality || 'NG').toUpperCase()] || 'NGN';

  const displayWallets = useMemo<Wallet[]>(() => {
    if (wallets?.length) {
      const targetWallet = wallets.find((wallet: Wallet) => wallet.currency === fallbackCurrency) || wallets[0];
      return wallets.map((wallet: Wallet) => {
        if (!mockFundedTotal) return wallet;
        if (wallet.id !== targetWallet.id) {
          return wallet;
        }
        const current = Number(wallet.balance) || 0;
        return { ...wallet, balance: (current + mockFundedTotal).toString() };
      });
    }
    if (!mockFundedTotal) return [];
    return [{ id: MOCK_WALLET_ID, currency: fallbackCurrency, balance: mockFundedTotal.toString() }];
  }, [wallets, mockFundedTotal, fallbackCurrency]);

  const primaryCurrency = displayWallets?.[0]?.currency || fallbackCurrency;

  function handleMockFundWallet() {
    const value = Number(fundAmount);
    if (!Number.isFinite(value) || value < MIN_FUND_AMOUNT) {
      setFundFeedback(`Enter a valid amount of at least ${MIN_FUND_AMOUNT}.`);
      return;
    }
    setMockFundedTotal((prev) => prev + value);
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: primaryCurrency });
    setFundFeedback(`${formatter.format(value)} credited successfully (mock).`);
    setFundAmount('');
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-text-primary">
          {getGreeting()}, {user?.firstName}! 👋
        </h1>
        <p className="text-text-muted mt-1">Here&apos;s your financial overview.</p>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface rounded-card border border-border p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">Total Wallets</p>
          <p className="mt-2 text-xl font-semibold text-text-primary">{displayWallets.length || 0}</p>
        </div>
        <div className="bg-surface rounded-card border border-border p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">Recent Txn</p>
          <p className="mt-2 text-xl font-semibold text-text-primary">{txData?.transactions?.length || 0}</p>
        </div>
        <div className="bg-surface rounded-card border border-border p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">Primary Wallet</p>
          <p className="mt-2 text-xl font-semibold text-text-primary">{displayWallets?.[0]?.currency || '—'}</p>
        </div>
        <div className="bg-surface rounded-card border border-border p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">Status</p>
          <p className="mt-2 text-xl font-semibold text-text-primary">Active</p>
        </div>
      </div>

      {/* Wallet cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Your Wallets</h2>
        {walletsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-subtle rounded-card animate-pulse" />)}
          </div>
        ) : displayWallets.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayWallets.map((w: Wallet) => (
              <WalletCard key={w.id} currency={w.currency} balance={w.balance} primary={w.currency === 'NGN'} />
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm">No wallets yet. Fund your account to get started.</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <Button className="w-full sm:w-auto min-h-11" onClick={() => setShowFundForm((prev) => !prev)}>
          Fund Wallet
        </Button>
        <Link href="/swap">
          <Button variant="secondary" className="w-full sm:w-auto min-h-11">Swap Now</Button>
        </Link>
      </div>
      {showFundForm ? (
        <div className="mb-8 bg-surface rounded-card border border-border p-4">
          <p className="text-sm font-semibold text-text-primary">Mock wallet funding</p>
          <p className="text-xs text-text-muted mt-1">This credits your wallet instantly in-app without leaving this page.</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <label htmlFor="mock-fund-amount" className="sr-only">Amount to credit wallet</label>
            <input
              id="mock-fund-amount"
              type="number"
              min={MIN_FUND_AMOUNT}
              value={fundAmount}
              onChange={(e) => {
                setFundAmount(e.target.value);
                setFundFeedback('');
              }}
              className="w-full sm:max-w-xs px-3 py-2.5 rounded-btn border border-border text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber"
              placeholder="Enter amount"
            />
            <Button type="button" onClick={handleMockFundWallet}>Credit Wallet</Button>
          </div>
          {fundFeedback ? <p className="text-xs text-success mt-2">{fundFeedback}</p> : null}
        </div>
      ) : (
        <div className="mb-8" />
      )}

      {/* Recent transactions */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Recent Transactions</h2>
          <Link href="/wallet" className="text-sm text-brand-amber hover:underline">View all</Link>
        </div>
        <div className="bg-surface rounded-card border border-border p-4">
          {txLoading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : txData?.transactions?.length ? (
            <div className="space-y-3">
              {txData.transactions.map((tx: Transaction) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-4">No transactions yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface rounded-card border border-border p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Rate Snapshot</h2>
          <p className="text-sm text-text-secondary">Track corridor performance in real-time and optimize your swaps.</p>
        </div>
        <div className="bg-surface rounded-card border border-border p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Wallet Mix</h2>
          <p className="text-sm text-text-secondary">Maintain diversified balances for smoother cross-border payments.</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Live Corridor Rates</h2>
        <RatesGrid />
      </div>

      <div className="mt-6 bg-brand-bg rounded-card border border-border p-4">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">Cross-border payments, unlocked</h2>
        <p className="text-sm text-text-secondary">
          Axios Pay partners with local banks across our supported countries and payment rails like Interswitch/Quickteller
          to make local-currency spending seamless. Example: if you travel from Nigeria to Nairobi for a conference, you can
          swap NGN to KES and pay directly in Kenya without routing through USD.
        </p>
      </div>
    </div>
  );
}
