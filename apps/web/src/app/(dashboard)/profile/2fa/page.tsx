'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function TwoFactorPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');

  async function handleSetup() {
    const result = await api.twoFactor.setup();
    setSetupData(result.data);
  }

  async function handleEnable() {
    await api.twoFactor.enable({ token });
    updateUser({ isTwoFactorEnabled: true });
    setMessage('2FA enabled successfully.');
    setToken('');
  }

  async function handleDisable() {
    await api.twoFactor.disable({ token });
    updateUser({ isTwoFactorEnabled: false });
    setMessage('2FA disabled successfully.');
    setToken('');
    setSetupData(null);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-text-primary">Two-Factor Authentication</h1>
      <Card>
        <p className="text-sm text-text-secondary mb-3">
          Status: {user?.isTwoFactorEnabled ? 'Enabled' : 'Disabled'}
        </p>
        {!user?.isTwoFactorEnabled && (
          <Button onClick={handleSetup}>Enable 2FA</Button>
        )}
        {setupData && (
          <div className="mt-4 space-y-3">
            <img src={setupData.qrCodeDataUrl} alt="2FA QR Code" className="w-56 h-56 border border-border rounded-btn" />
            <p className="text-sm text-text-secondary break-all">Secret: {setupData.secret}</p>
            <Input label="Authenticator code" value={token} onChange={(e) => setToken(e.target.value)} />
            <Button onClick={handleEnable} disabled={token.length !== 6}>Confirm & Enable</Button>
          </div>
        )}
        {user?.isTwoFactorEnabled && (
          <div className="mt-4 space-y-3">
            <Input label="Authenticator code" value={token} onChange={(e) => setToken(e.target.value)} />
            <Button variant="danger" onClick={handleDisable} disabled={token.length !== 6}>Disable 2FA</Button>
          </div>
        )}
        {message && <p className="text-sm text-success mt-3">{message}</p>}
      </Card>
    </div>
  );
}
