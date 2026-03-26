'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PINInput } from '@/components/ui/PINInput';

const KYC_DESCRIPTIONS: Record<string, string> = {
  PENDING: 'Identity verification not yet started.',
  SUBMITTED: 'Your documents are under review.',
  APPROVED: 'Identity verified. You have full access.',
  REJECTED: 'Verification failed. Please contact support.',
};

const NATIONALITY_NAMES: Record<string, string> = {
  NG: '🇳🇬 Nigeria', UG: '🇺🇬 Uganda', KE: '🇰🇪 Kenya', GH: '🇬🇭 Ghana', ZA: '🇿🇦 South Africa',
};

const schema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export default function ProfilePage() {
  const { user, updateUser, clearAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pinState, setPinState] = useState({ currentPin: '', newPin: '' });
  const [limit, setLimit] = useState(user?.dailySwapLimit || '1000000');
  const [freezePin, setFreezePin] = useState('');
  const [unfreezeOtp, setUnfreezeOtp] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { firstName: user?.firstName, lastName: user?.lastName },
  });

  async function onSubmit(data: { firstName?: string; lastName?: string }) {
    setLoading(true);
    try {
      const result = await api.users.updateMe(data);
      updateUser(result.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePin() {
    await api.pin.change(pinState);
    setPinState({ currentPin: '', newPin: '' });
    setMessage('PIN changed successfully.');
  }

  async function handleUpdateLimit() {
    const parsedLimit = Number.parseFloat(limit);
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setMessage('Enter a valid positive daily limit.');
      return;
    }

    const result = await api.users.updateLimits({ dailySwapLimit: parsedLimit });
    updateUser(result.data);
    setMessage('Daily limit updated.');
  }

  async function handleFreeze() {
    await api.users.freeze({ pin: freezePin });
    clearAuth();
    router.push('/login?message=Your account has been frozen. Contact support to unfreeze.');
  }

  async function handleRequestUnfreezeOtp() {
    await api.users.requestUnfreezeOtp();
    setMessage('Unfreeze OTP sent to your email.');
  }

  async function handleUnfreeze() {
    await api.users.unfreeze({ otp: unfreezeOtp });
    updateUser({ isFrozen: false });
    setMessage('Account unfrozen.');
  }

  async function handleLogout() {
    try {
      const stored = localStorage.getItem('axiospay-auth');
      const refreshToken = stored ? JSON.parse(stored)?.state?.refreshToken : null;
      if (refreshToken) await api.auth.logout({ refreshToken });
    } catch { /* ignore */ }
    clearAuth();
    router.push('/');
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-text-primary">Profile</h1>

      {/* Account info */}
      <Card>
        <h2 className="font-semibold text-text-primary mb-4">Account Details</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Email</span>
            <span className="text-text-primary">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Phone</span>
            <span className="text-text-primary">{user?.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Country</span>
            <span className="text-text-primary">{NATIONALITY_NAMES[user?.nationality || ''] || user?.nationality}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Member since</span>
            <span className="text-text-primary">{user ? new Date(user.createdAt || Date.now()).toLocaleDateString() : '—'}</span>
          </div>
        </div>
      </Card>

      {/* KYC */}
      <Card>
        <h2 className="font-semibold text-text-primary mb-3">Identity Verification</h2>
        <div className="flex items-center gap-3 mb-2">
          <Badge status={user?.kycStatus || 'PENDING'} />
          <span className="text-sm text-text-secondary">{KYC_DESCRIPTIONS[user?.kycStatus || 'PENDING']}</span>
        </div>
      </Card>

      {/* Edit name */}
      <Card>
        <h2 className="font-semibold text-text-primary mb-4">Edit Profile</h2>
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-btn text-sm text-success">Profile updated!</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="First Name" {...register('firstName')} error={errors.firstName?.message} />
          <Input label="Last Name" {...register('lastName')} error={errors.lastName?.message} />
          <Button type="submit" loading={loading}>Save Changes</Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-text-primary mb-4">Transaction PIN</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-text-secondary mb-2">Current PIN</p>
            <PINInput value={pinState.currentPin} onChange={(v) => setPinState((s) => ({ ...s, currentPin: v }))} />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-2">New PIN</p>
            <PINInput value={pinState.newPin} onChange={(v) => setPinState((s) => ({ ...s, newPin: v }))} />
          </div>
          <Button onClick={handleChangePin} disabled={pinState.currentPin.length !== 4 || pinState.newPin.length !== 4}>
            Change PIN
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-text-primary mb-4">Spending Limits</h2>
        <div className="space-y-3">
          <div className="text-sm text-text-secondary">
            Used today: {user?.dailySwapUsed || '0'} / {user?.dailySwapLimit || '1000000'}
          </div>
          <Input
            label="Daily swap limit"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
          <Button onClick={handleUpdateLimit}>Update Limit</Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-error mb-4">Freeze Account</h2>
        <p className="text-sm text-text-secondary mb-3">
          Freezing your account logs you out and blocks all protected actions until unfreezing with email OTP.
        </p>
        {!user?.isFrozen ? (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Enter transaction PIN to freeze:</p>
            <PINInput value={freezePin} onChange={setFreezePin} />
            <Button variant="danger" onClick={handleFreeze} disabled={freezePin.length !== 4}>
              Freeze Account
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={handleRequestUnfreezeOtp}>Send Unfreeze OTP</Button>
            <Input label="Email OTP" value={unfreezeOtp} onChange={(e) => setUnfreezeOtp(e.target.value)} />
            <Button onClick={handleUnfreeze} disabled={unfreezeOtp.length !== 6}>Unfreeze Account</Button>
          </div>
        )}
      </Card>

      {message && (
        <Card>
          <div className="text-sm text-success">{message}</div>
        </Card>
      )}

      {/* Logout */}
      <Card>
        <Button variant="danger" onClick={handleLogout} className="w-full">Log Out</Button>
      </Card>
    </div>
  );
}
