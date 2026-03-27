'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';

const DEFAULT_NATIONALITY = 'NG';

export default function KycPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    idNumber: '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    dateOfBirth: '',
  });
  const { data: requirements } = useQuery({
    queryKey: ['kyc', 'requirements'],
    queryFn: () => api.kyc.requirements().then((r) => r.data),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ['kyc', 'status'],
    queryFn: () => api.kyc.status().then((r) => r.data),
  });
  const [submitError, setSubmitError] = useState('');
  const [submitFeedback, setSubmitFeedback] = useState('');
  const mutation = useMutation({
    mutationFn: () => api.kyc.verifyIdentity(form).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setSubmitFeedback('Identity verified successfully. Tier 2 benefits are now active.');
      setSubmitError('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setSubmitError(e?.response?.data?.message || 'Identity verification failed. Please check your details and try again.');
      setSubmitFeedback('');
    },
  });
  const status = data?.idVerificationStatus || 'NOT_SUBMITTED';
  const showForm = status === 'NOT_SUBMITTED' || status === 'FAILED';
  const formatHint = requirements?.format || '';

  const maskedInput = useMemo(() => {
    if ((user?.nationality || DEFAULT_NATIONALITY) === 'GH') {
      const plain = form.idNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (plain.startsWith('GHA')) {
        const rest = plain.slice(3);
        const first = rest.slice(0, 9);
        const last = rest.slice(9, 10);
        return `GHA-${first}${last ? `-${last}` : ''}`;
      }
    }
    return form.idNumber;
  }, [form.idNumber, user?.nationality]);

  const idValidationError = useMemo(() => {
    const id = form.idNumber.trim().toUpperCase();
    const nationality = (user?.nationality || DEFAULT_NATIONALITY).toUpperCase();
    if (!id) return 'ID number is required.';
    if (nationality === 'NG' && !/^\d{11}$/.test(id)) return 'NIN must be exactly 11 digits.';
    if (nationality === 'UG' && !/^[A-Za-z0-9]{14}$/.test(id)) return 'Ndaga Muntu ID must be 14 alphanumeric characters.';
    if (nationality === 'KE' && !/^\d{8}$/.test(id)) return 'Kenyan National ID must be exactly 8 digits.';
    if (nationality === 'GH' && !/^GHA-\d{9}-\d$/.test(id)) return 'Ghana Card must match GHA-123456789-0.';
    if (nationality === 'ZA' && !/^\d{13}$/.test(id)) return 'South African ID must be exactly 13 digits.';
    return '';
  }, [form.idNumber, user?.nationality]);

  const canSubmit =
    Boolean(form.firstName.trim()) &&
    Boolean(form.lastName.trim()) &&
    Boolean(form.dateOfBirth) &&
    !idValidationError &&
    !mutation.isPending;
  const submitHint = canSubmit
    ? ''
    : !form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth
      ? 'Enter your first name, last name, and date of birth.'
      : idValidationError;

  function handleSubmit() {
    setSubmitError('');
    setSubmitFeedback('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) {
      setSubmitError('First name, last name, and date of birth are required.');
      return;
    }
    if (idValidationError) {
      setSubmitError(idValidationError);
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-text-primary mb-6">KYC Verification</h1>
      {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : error ? (
        <Card className="border-error bg-red-50 text-error">Unable to fetch KYC status.</Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold text-text-primary mb-3">Verification tiers</h2>
            <div className="space-y-3 text-sm">
              <p><strong>TIER 1 — Basic Account</strong><br />✓ Swap up to 50,000 NGN/day • ✗ Remittance locked</p>
              <p><strong>TIER 2 — Verified Identity</strong><br />✓ Swap up to 500,000 NGN/day • ✓ All features unlocked</p>
              <p><strong>TIER 3 — Business Verified</strong><br />✓ Swap up to 5,000,000 NGN/day • ✓ Bulk payroll + API access</p>
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold text-text-primary mb-3">National identity validation details</h2>
            <div className="space-y-2 text-sm text-text-secondary">
              <p><strong>NG (NIN):</strong> exactly 11 digits</p>
              <p><strong>UG (Ndaga Muntu ID):</strong> 14 alphanumeric characters</p>
              <p><strong>KE (National ID):</strong> exactly 8 digits</p>
              <p><strong>GH (Ghana Card):</strong> format <code>GHA-123456789-0</code></p>
              <p><strong>ZA (South African ID):</strong> exactly 13 digits with checksum validation</p>
            </div>
            <p className="text-xs text-text-muted mt-3">
              Based on your profile nationality ({(user?.nationality || DEFAULT_NATIONALITY).toUpperCase()}), your ID is validated before submission.
            </p>
          </Card>
          <Card className="text-center py-6">
            <ShieldCheck className="w-10 h-10 text-brand-amber mx-auto mb-3" />
            <p className="font-semibold text-text-primary mb-2">Current verification state</p>
            <div className="flex justify-center mb-2"><Badge status={status} /></div>
            {status === 'FAILED' && data?.idVerificationFailureReason ? (
              <p className="text-sm text-error">{data.idVerificationFailureReason}</p>
            ) : null}
            {status === 'PENDING' ? (
              <p className="text-sm text-text-secondary">Verification in progress...</p>
            ) : null}
            {status === 'VERIFIED' ? (
              <p className="text-sm text-success">
                Verified {data?.firstName} {data?.lastName} on {data?.idVerifiedAt ? new Date(data.idVerifiedAt).toLocaleDateString() : ''}
              </p>
            ) : null}
            {status === 'VERIFIED' ? (
              <p className="text-sm text-success mt-1" aria-live="polite">
                ✅ Tier 2 benefits unlocked: swap up to {Number(data?.dailySwapLimit || 0).toLocaleString()} NGN/day and access all features.
              </p>
            ) : null}
            <p className="text-xs text-text-muted mt-2">
              Daily limit: {Number(data?.dailySwapUsed || 0).toLocaleString()} / {Number(data?.dailySwapLimit || 0).toLocaleString()} NGN
            </p>
          </Card>
          {showForm ? (
            <Card className="space-y-3">
              <div>
                <label className="text-sm font-medium text-text-primary">{requirements?.label || 'National ID'}</label>
                <input
                  value={maskedInput}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, idNumber: e.target.value }));
                    setSubmitError('');
                    setSubmitFeedback('');
                  }}
                  className="w-full px-3 py-2.5 rounded-btn border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber text-text-primary mt-1"
                  placeholder={requirements?.example || ''}
                />
                <p className="text-xs text-text-muted mt-1">{formatHint}</p>
                {idValidationError ? <p className="text-xs text-error mt-1" role="alert">{idValidationError}</p> : null}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-text-primary">First name</label>
                  <input value={form.firstName} onChange={(e) => {
                    setForm((prev) => ({ ...prev, firstName: e.target.value }));
                    setSubmitError('');
                    setSubmitFeedback('');
                  }} className="w-full px-3 py-2.5 rounded-btn border border-border bg-surface mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-primary">Last name</label>
                  <input value={form.lastName} onChange={(e) => {
                    setForm((prev) => ({ ...prev, lastName: e.target.value }));
                    setSubmitError('');
                    setSubmitFeedback('');
                  }} className="w-full px-3 py-2.5 rounded-btn border border-border bg-surface mt-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Date of birth</label>
                <input type="date" value={form.dateOfBirth} onChange={(e) => {
                  setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }));
                  setSubmitError('');
                  setSubmitFeedback('');
                }} className="w-full px-3 py-2.5 rounded-btn border border-border bg-surface mt-1" />
              </div>
              <p className="text-xs text-text-muted">Your ID number is encrypted and never stored in plain text. We only use it to verify your identity.</p>
              {submitError ? <p className="text-xs text-error" role="alert" aria-live="polite">{submitError}</p> : null}
              {submitFeedback ? <p className="text-xs text-success" role="status" aria-live="polite">{submitFeedback}</p> : null}
              {!canSubmit ? <p className="text-xs text-text-muted">{submitHint}</p> : null}
              <Button type="button" className="w-full" loading={mutation.isPending} disabled={!canSubmit} onClick={handleSubmit}>Verify Identity</Button>
              <p className="text-xs text-text-muted">Attempts remaining: {data?.attemptsRemaining ?? 3}</p>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
