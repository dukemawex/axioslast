'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PINInput } from '@/components/ui/PINInput';

interface PINVerifyModalProps {
  open: boolean;
  onVerified: (pinToken: string) => void;
  onClose: () => void;
}

export function PINVerifyModal({ open, onVerified, onClose }: PINVerifyModalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleVerify() {
    if (pin.length !== 4) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.pin.verify({ pin });
      onVerified(result.data.pinToken);
      setPin('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'PIN verification failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Verify Transaction PIN">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Enter your 4-digit PIN to continue this transaction.
        </p>
        <PINInput value={pin} onChange={setPin} />
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-btn text-sm text-error">{error}</div>
        )}
        <Button onClick={handleVerify} loading={loading} className="w-full" disabled={pin.length !== 4}>
          Verify PIN
        </Button>
      </div>
    </Modal>
  );
}
