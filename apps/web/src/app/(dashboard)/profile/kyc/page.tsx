'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';

const TIER_ORDER = ['NONE', 'BASIC', 'STANDARD', 'PREMIUM'] as const;
type KycTier = typeof TIER_ORDER[number];

const TIER_INFO: Record<KycTier, { label: string; daily: string; monthly: string; color: string }> = {
  NONE:     { label: 'None',     daily: '50,000',     monthly: '200,000',    color: 'bg-gray-200 text-gray-700' },
  BASIC:    { label: 'Basic',    daily: '200,000',    monthly: '1,000,000',  color: 'bg-blue-100 text-blue-700' },
  STANDARD: { label: 'Standard', daily: '1,000,000',  monthly: '5,000,000',  color: 'bg-amber-100 text-amber-700' },
  PREMIUM:  { label: 'Premium',  daily: '5,000,000',  monthly: '25,000,000', color: 'bg-green-100 text-green-700' },
};

interface IdTypeOption {
  key: string;
  label: string;
  formatHint: string;
  tier: string;
}

interface KycStatusData {
  kycTier?: string;
  kycVerifiedAt?: string | null;
  idVerificationStatus?: string;
  idVerificationFailureReason?: string | null;
  hasBvn?: boolean;
  hasNin?: boolean;
  attemptsRemaining?: number;
  firstName?: string;
  lastName?: string;
}

export default function KycPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [country, setCountry] = useState(user?.nationality?.toUpperCase() || 'NG');
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [step, setStep] = useState(1);
  const [successTier, setSuccessTier] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');

  const { data: kycData, isLoading } = useQuery({
    queryKey: ['kyc', 'status'],
    queryFn: () => api.kyc.status().then((r) => r.data as KycStatusData),
  });

  const { data: idTypes } = useQuery({
    queryKey: ['kyc', 'identity-types', country],
    queryFn: () => api.kyc.identityTypes(country).then((r) => r.data as IdTypeOption[]),
    enabled: Boolean(country),
  });

  const currentTier = (kycData?.kycTier as KycTier) ?? 'NONE';
  const tierIndex = TIER_ORDER.indexOf(currentTier);
  const isVerified = kycData?.idVerificationStatus === 'VERIFIED';
  const selectedConfig = (idTypes || []).find((t) => t.key === idType);

  useEffect(() => {
    if (idTypes?.length && !idType) setIdType(idTypes[0].key);
  }, [idTypes, idType]);

  const genericMutation = useMutation({
    mutationFn: () =>
      api.kyc.verify({
        country, idType, idNumber,
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        dateOfBirth: '',
      }).then((r) => r.data),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      setSuccessTier((d as { tier?: string }).tier || 'STANDARD');
      setSubmitError('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setSubmitError(e?.response?.data?.message || 'Verification failed. Please try again.');
    },
  });

  const bvnMutation = useMutation({
    mutationFn: () =>
      api.kyc.bvn({ bvn: idNumber, firstName: user?.firstName || '', lastName: user?.lastName || '', dateOfBirth: '' }).then((r) => r.data),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      setSuccessTier((d as { tier?: string }).tier || 'STANDARD');
      setSubmitError('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setSubmitError(e?.response?.data?.message || 'BVN verification failed.');
    },
  });

  const ninMutation = useMutation({
    mutationFn: () =>
      api.kyc.nin({ nin: idNumber, firstName: user?.firstName || '', lastName: user?.lastName || '' }).then((r) => r.data),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      setSuccessTier((d as { tier?: string }).tier || 'PREMIUM');
      setSubmitError('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setSubmitError(e?.response?.data?.message || 'NIN verification failed.');
    },
  });

  const anyPending = genericMutation.isPending || bvnMutation.isPending || ninMutation.isPending;

  function handleSubmit() {
    setSubmitError('');
    if (country === 'NG' && idType === 'BVN') { bvnMutation.mutate(); return; }
    if (country === 'NG' && idType === 'NIN') { ninMutation.mutate(); return; }
    genericMutation.mutate();
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-text-primary">KYC Verification</h1>

      <Card>
        <h2 className="font-semibold text-text-primary mb-4">Your KYC Tier</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {TIER_ORDER.map((tier, idx) => {
            const info = TIER_INFO[tier];
            const isActive = tier === currentTier;
            const isPast = idx <= tierIndex;
            const borderClass = isActive
              ? 'border-brand-amber ' + info.color
              : isPast
              ? 'border-green-400 bg-green-50'
              : 'border-border bg-subtle';
            return (
              <div key={tier} className="flex items-center gap-2 min-w-0">
                <div className={'flex flex-col items-center px-3 py-2 rounded-lg border-2 min-w-[100px] ' + borderClass}>
                  <span className={'text-xs font-bold ' + (isActive ? '' : isPast ? 'text-green-700' : 'text-text-muted')}>{info.label}</span>
                  <span className="text-xs text-text-secondary mt-1">{'₦'}{info.daily}/day</span>
                  <span className="text-xs text-text-muted">{'₦'}{info.monthly}/mo</span>
                </div>
                {idx < TIER_ORDER.length - 1 && (
                  <span className={'text-lg font-bold ' + (isPast && idx < tierIndex ? 'text-green-500' : 'text-text-muted')}>&rarr;</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {isVerified && !successTier && (
        <Card className="flex items-center gap-3 bg-green-50 border-green-200">
          <CheckCircle2 className="w-8 h-8 text-success flex-shrink-0" />
          <div>
            <p className="font-semibold text-text-primary">Identity Verified</p>
            <p className="text-sm text-text-secondary">
              Current tier: <strong>{currentTier}</strong>
              {kycData?.kycVerifiedAt ? ' • Verified ' + new Date(kycData.kycVerifiedAt).toLocaleDateString() : ''}
            </p>
          </div>
        </Card>
      )}

      {successTier && (
        <Card className="text-center bg-green-50 border-green-200 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
          <p className="text-sm text-text-secondary">Upgraded to <strong>{successTier}</strong> tier.</p>
          <Button type="button" className="w-full" onClick={() => { setSuccessTier(null); setIdNumber(''); }}>Continue</Button>
        </Card>
      )}

      {!successTier && (
        <Card className="space-y-4">
          <h2 className="font-semibold text-text-primary">Verify Your Identity</h2>
          <p className="text-xs text-text-muted">Attempts remaining today: {kycData?.attemptsRemaining ?? 3}</p>

          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Step 1 — Country</label>
            <select value={country} onChange={(e) => { setCountry(e.target.value); setIdType(''); setStep(2); }}
              className="w-full px-3 py-2.5 rounded-btn border border-border text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber">
              {[
                { code: 'NG', name: 'Nigeria' }, { code: 'UG', name: 'Uganda' }, { code: 'KE', name: 'Kenya' },
                { code: 'GH', name: 'Ghana' }, { code: 'ZA', name: 'South Africa' }, { code: 'EG', name: 'Egypt' },
                { code: 'TZ', name: 'Tanzania' }, { code: 'RW', name: 'Rwanda' }, { code: 'ZM', name: 'Zambia' },
                { code: 'MW', name: 'Malawi' },
              ].map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>

          {step >= 2 && idTypes && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Step 2 — Document Type</label>
              <select value={idType} onChange={(e) => { setIdType(e.target.value); setStep(3); }}
                className="w-full px-3 py-2.5 rounded-btn border border-border text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber">
                <option value="">Select document type</option>
                {idTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
          )}

          {step >= 3 && idType && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Step 3 — Document Number</label>
              <input value={idNumber} onChange={(e) => { setIdNumber(e.target.value.toUpperCase()); setStep(4); }}
                className="w-full px-3 py-2.5 rounded-btn border border-border text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber"
                placeholder="Enter your document number" />
              {selectedConfig?.formatHint && <p className="text-xs text-text-muted">{selectedConfig.formatHint}</p>}
            </div>
          )}

          {step >= 4 && idNumber && (
            <div className="rounded-btn border border-border p-3 bg-subtle text-sm space-y-1">
              <p className="font-medium text-text-primary">Step 4 — Details for verification:</p>
              <p className="text-text-secondary">Name: {user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-text-muted">First name, last name, and date of birth are from your profile.</p>
            </div>
          )}

          {country === 'NG' && (
            <div className="space-y-1 text-xs">
              {!kycData?.hasBvn && <p className="text-text-secondary">Tip: Verify BVN first to reach STANDARD tier.</p>}
              {kycData?.hasBvn && !kycData?.hasNin && <p className="text-success">✓ BVN verified. Verify NIN to reach PREMIUM tier.</p>}
              {kycData?.hasBvn && kycData?.hasNin && <p className="text-success">✓ Both BVN and NIN verified. PREMIUM tier active.</p>}
            </div>
          )}

          {submitError && <p className="text-sm text-error" role="alert">{submitError}</p>}
          {kycData?.idVerificationFailureReason && !submitError && (
            <p className="text-sm text-error flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />{kycData.idVerificationFailureReason}
            </p>
          )}

          {anyPending ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-5 h-5 text-brand-amber animate-spin" />
              <span className="text-sm text-text-secondary">Verifying your identity...</span>
            </div>
          ) : (
            <Button type="button" className="w-full"
              disabled={!idType || !idNumber || (kycData?.attemptsRemaining ?? 3) <= 0}
              onClick={handleSubmit}>
              Step 5 — Verify Identity
            </Button>
          )}

          <p className="text-xs text-text-muted">Your document number is hashed using SHA-256 and never stored in plain text.</p>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-text-primary mb-3">Tier Limits</h2>
        <div className="space-y-2 text-sm">
          {TIER_ORDER.map((tier) => {
            const info = TIER_INFO[tier];
            const active = tier === currentTier;
            return (
              <div key={tier} className={'rounded-btn p-3 ' + (active ? 'bg-brand-bg border border-brand-amber' : 'bg-subtle')}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={'px-2 py-0.5 rounded-full text-xs font-bold ' + info.color}>{info.label}</span>
                  {active && <span className="text-xs text-brand-amber font-semibold">Current</span>}
                </div>
                <p className="text-text-secondary">Daily: {'₦'}{info.daily} • Monthly: {'₦'}{info.monthly}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
