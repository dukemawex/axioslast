'use client';
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

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => api.wallets.getAll().then(r => r.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', 1],
    queryFn: () => api.wallets.getTransactions({ page: 1, limit: 5 }).then(r => r.data),
  });

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
          <p className="mt-2 text-xl font-semibold text-text-primary">{wallets?.length || 0}</p>
        </div>
        <div className="bg-surface rounded-card border border-border p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">Recent Txn</p>
          <p className="mt-2 text-xl font-semibold text-text-primary">{txData?.transactions?.length || 0}</p>
        </div>
        <div className="bg-surface rounded-card border border-border p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">Primary Wallet</p>
          <p className="mt-2 text-xl font-semibold text-text-primary">{wallets?.[0]?.currency || '—'}</p>
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
        ) : wallets?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wallets.map((w: Wallet) => (
              <WalletCard key={w.id} currency={w.currency} balance={w.balance} primary={w.currency === 'NGN'} />
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm">No wallets yet. Fund your account to get started.</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <Link href="/deposit">
          <Button className="w-full sm:w-auto min-h-11">Fund Wallet</Button>
        </Link>
        <Link href="/swap">
          <Button variant="secondary" className="w-full sm:w-auto min-h-11">Swap Now</Button>
        </Link>
      </div>

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
