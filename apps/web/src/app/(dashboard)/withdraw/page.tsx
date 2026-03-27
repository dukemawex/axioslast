'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { PINVerifyModal } from '@/components/PINVerifyModal';

interface Bank {
  code: string;
  name: string;
}

interface Wallet {
  id: string;
  currency: string;
  balance: string;
}

export default function WithdrawPage() {
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('1000');
  const [narration, setNarration] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [mode, setMode] = useState<'bank' | 'axios'>('bank');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [pinToken, setPinToken] = useState<string | null>(null);

  const { data: banks } = useQuery({
    queryKey: ['banks'],
    queryFn: () => api.wallets.getBanks().then((r) => r.data as Bank[]),
  });

  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => api.wallets.getAll().then((r) => r.data as Wallet[]),
  });

  const ngnBalance = useMemo(() => {
    const wallet = (wallets || []).find((w) => w.currency === 'NGN');
    return wallet ? Number(wallet.balance) : 0;
  }, [wallets]);

  useEffect(() => {
    if (accountNumber.length !== 10 || !bankCode) return;
    api.wallets
      .resolveBankAccount({ bankCode, accountNumber })
      .then((r) => setAccountName(r.data?.accountName || ''))
      .catch(() => setAccountName(''));
  }, [accountNumber, bankCode]);

  useEffect(() => {
    if (!pinToken || !pending) return;
    setLoading(true);
    setMessage('');
    api.wallets
      [mode === 'bank' ? 'sendTransfer' : 'transferToAxiosUser'](
        mode === 'bank'
          ? {
              bankCode,
              accountNumber,
              accountName,
              amount: Number(amount),
              narration: narration || undefined,
            }
          : {
              recipientEmail,
              amount: Number(amount),
              narration: narration || undefined,
            },
        pinToken
      )
      .then((r) => setMessage(r.data?.status === 'SUCCESS' ? 'Withdrawal successful' : 'Withdrawal failed'))
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setMessage(e?.response?.data?.message || e?.message || 'Withdrawal failed.');
      })
      .finally(() => {
        setLoading(false);
        setPending(false);
        setPinToken(null);
      });
  }, [pinToken, pending, bankCode, accountNumber, accountName, amount, narration]);

  function requestWithdraw() {
    setPending(true);
    setPinOpen(true);
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-text-primary mb-6">Withdraw</h1>
      <Card className="space-y-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode('bank')} className={`px-3 py-2 rounded-btn text-sm ${mode === 'bank' ? 'bg-brand-amber text-white' : 'bg-subtle text-text-secondary'}`}>Bank Transfer</button>
          <button type="button" onClick={() => setMode('axios')} className={`px-3 py-2 rounded-btn text-sm ${mode === 'axios' ? 'bg-brand-amber text-white' : 'bg-subtle text-text-secondary'}`}>Axios Pay User</button>
        </div>
        <p className="text-sm text-text-secondary">Available NGN balance: ₦{ngnBalance.toFixed(2)}</p>
        {mode === 'bank' ? (
          <>
        <div className="space-y-1">
          <label className="text-sm font-medium text-text-primary">Bank</label>
          <select
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            className="w-full px-3 py-2.5 rounded-btn border border-border text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber"
          >
            <option value="">Select bank</option>
            {(banks || []).map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
        </div>
          </>
        ) : (
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Recipient Axios Pay Email</label>
            <input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-btn border border-border text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber"
              placeholder="recipient@example.com"
            />
            <p className="text-xs text-text-muted">Mock internal transfer for demo.</p>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium text-text-primary">Account Number</label>
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="w-full px-3 py-2.5 rounded-btn border border-border text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber"
            placeholder="0123456789"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-text-primary">Account Name</label>
          <input
            value={accountName}
            readOnly
            className="w-full px-3 py-2.5 rounded-btn border border-border text-text-primary bg-subtle focus:outline-none"
            placeholder="Resolved account name"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-text-primary">Amount (₦)</label>
          <input
            type="number"
            min={1000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2.5 rounded-btn border border-border text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-text-primary">Narration (optional)</label>
          <input
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            className="w-full px-3 py-2.5 rounded-btn border border-border text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber"
          />
        </div>
        <Button
          onClick={requestWithdraw}
          loading={loading}
          disabled={
            mode === 'bank'
              ? (!bankCode || accountNumber.length !== 10 || !accountName || Number(amount) < 1000)
              : (!recipientEmail || Number(amount) < 100)
          }
          className="w-full"
        >
          {mode === 'bank' ? 'Withdraw to Bank' : 'Transfer to Axios Pay User'}
        </Button>
        {message && <div className="p-3 bg-brand-bg rounded-btn text-sm text-text-primary">{message}</div>}
      </Card>

      <PINVerifyModal
        open={pinOpen}
        onClose={() => {
          if (!loading) {
            setPinOpen(false);
            setPending(false);
          }
        }}
        onVerified={(token) => {
          setPinToken(token);
          setPinOpen(false);
        }}
      />
    </div>
  );
}
