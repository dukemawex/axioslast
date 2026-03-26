'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PINInput } from '@/components/ui/PINInput';
import { useAuthStore } from '@/store/authStore';

interface PINSetupModalProps {
  open: boolean;
}

export function PINSetupModal({ open }: PINSetupModalProps) {
  const noop = () => undefined;
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const updateUser = useAuthStore((s) => s.updateUser);

  async function handleSubmit() {
    if (pin.length !== 4 || confirmPin.length !== 4) return;
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.pin.set({ pin });
      updateUser({ isPinSet: true });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Unable to set PIN.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={noop} title="Set Transaction PIN" hideCloseButton closeOnOverlayClick={false}>
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          You must set your 4-digit transaction PIN before continuing.
        </p>
        <div>
          <p className="text-sm text-text-secondary mb-2">Enter PIN</p>
          <PINInput value={pin} onChange={setPin} />
        </div>
        <div>
          <p className="text-sm text-text-secondary mb-2">Confirm PIN</p>
          <PINInput value={confirmPin} onChange={setConfirmPin} />
        </div>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-btn text-sm text-error">{error}</div>
        )}
        <Button onClick={handleSubmit} loading={loading} className="w-full" disabled={pin.length !== 4 || confirmPin.length !== 4}>
          Save PIN
        </Button>
      </div>
    </Modal>
  );
}
