'use client';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

export function KYCBanner({ verified }: { verified: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (verified || dismissed) return null;
  return (
    <div className="mb-4 rounded-btn border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="w-4 h-4" />
        <span>Verify your identity to unlock higher limits and all features.</span>
        <Link href="/profile/kyc" className="font-medium underline">Verify Now →</Link>
      </div>
      <button type="button" onClick={() => setDismissed(true)} className="text-amber-800 hover:text-amber-900">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
