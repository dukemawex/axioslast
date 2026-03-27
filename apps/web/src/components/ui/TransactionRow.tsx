import { ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { getCurrencyDisplay } from '@/lib/currencies';
import { Badge } from './Badge';

const TYPE_ICONS = {
  DEPOSIT: <ArrowDownLeft className="w-4 h-4 text-success" />,
  SWAP: <RefreshCw className="w-4 h-4 text-brand-amber" />,
  WITHDRAWAL: <ArrowUpRight className="w-4 h-4 text-error" />,
};

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
  onRequestRefund?: () => void;
  canRefund?: boolean;
}

export function TransactionRow({ tx }: { tx: Transaction }) {
  const fmt = (n: string | number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(Number(n));
  const date = new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="border border-border rounded-btn p-3 sm:border-0 sm:rounded-none sm:p-0 sm:flex sm:items-center sm:gap-4 sm:py-3 sm:border-b sm:last:border-0">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-8 h-8 rounded-full bg-subtle flex items-center justify-center flex-shrink-0">
          {TYPE_ICONS[tx.type as keyof typeof TYPE_ICONS] || <RefreshCw className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{tx.narration || tx.type}</p>
          <p className="text-xs text-text-muted">{date}</p>
        </div>
        <div className="sm:hidden">
          <Badge status={tx.status} />
        </div>
      </div>
      <div className="mt-2 sm:mt-0 sm:ml-auto text-left sm:text-right flex-shrink-0">
        <p className="text-sm font-mono font-medium text-text-primary">
          {fmt(tx.fromAmount)} {getCurrencyDisplay(tx.fromCurrency)}
          {tx.fromCurrency !== tx.toCurrency && ` → ${fmt(tx.toAmount)} ${getCurrencyDisplay(tx.toCurrency)}`}
        </p>
        <div className="hidden sm:block">
          <Badge status={tx.status} />
        </div>
        {tx.canRefund && tx.onRequestRefund && (
          <button
            type="button"
            aria-label="Request refund for transaction"
            onClick={tx.onRequestRefund}
            className="mt-2 sm:mt-1 text-xs text-brand-amber hover:underline"
          >
            Request Refund
          </button>
        )}
      </div>
    </div>
  );
}
