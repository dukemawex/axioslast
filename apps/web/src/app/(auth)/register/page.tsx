'use client';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { NATIONALITY_TO_DIAL_CODE, PHONE_COUNTRY_OPTIONS } from '@/lib/currencies';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

const step1Schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email required'),
  nationality: z.enum(['NG', 'UG', 'KE', 'GH', 'ZA'], { required_error: 'Select your country' }),
});

const step2BaseSchema = z.object({
  countryCode: z.string().min(1, 'Select country code'),
  localPhone: z.string().regex(/^\d{6,14}$/, 'Enter a valid local phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Confirm Password is required'),
});

const step2Schema = step2BaseSchema
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [step1Data, setStep1Data] = useState<Step1 | null>(null);
  const [registeredUserId, setRegisteredUserId] = useState('');
  const [identityData, setIdentityData] = useState({
    idNumber: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2>({
    resolver: zodResolver(step2Schema),
    mode: 'onChange',
    defaultValues: { countryCode: '+234', localPhone: '' },
  });
  const passwordValue = form2.watch('password', '');
  const confirmPasswordValue = form2.watch('confirmPassword', '');
  const confirmPasswordMatches = confirmPasswordValue.length > 0 && confirmPasswordValue === passwordValue;
  const passwordChecks = useMemo(
    () => [
      { label: 'At least 8 characters', met: passwordValue.length >= 8 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(passwordValue) },
      { label: 'One number', met: /\d/.test(passwordValue) },
    ],
    [passwordValue]
  );

  async function onStep1(data: Step1) {
    setError('');
    setStep1Data(data);
    form2.setValue('countryCode', NATIONALITY_TO_DIAL_CODE[data.nationality]);
    setStep(2);
  }

  async function onStep2(data: Step2) {
    if (!step1Data || loading) return;
    const localPhone = data.localPhone.replace(/\D/g, '').replace(/^0+/, '');
    if (!localPhone) {
      form2.setError('localPhone', { type: 'manual', message: 'Enter a valid local phone number' });
      return;
    }
    const phone = `${data.countryCode}${localPhone}`;
    setLoading(true);
    setError('');
    try {
      const result = await api.auth.register({
        ...step1Data,
        phone,
        password: data.password,
      });
      const userId = result.data?.userId as string | undefined;
      if (!userId) {
        setError('Registration failed. Please try again.');
        return;
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('verify_userId', userId);
        sessionStorage.setItem('verify_email', step1Data.email);
      }
      setRegisteredUserId(userId);
      setIdentityData({
        idNumber: '',
        firstName: step1Data.firstName,
        lastName: step1Data.lastName,
        dateOfBirth: '',
      });
      setStep(3);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; details?: Array<{ path?: string[]; message?: string }> } } };
      const code = e?.response?.data?.error || '';
      if (code === 'VALIDATION_ERROR') {
        const details = e?.response?.data?.details || [];
        details.forEach((detail) => {
          const field = detail.path?.[0];
          if (!field || !detail.message) return;
          if (field in step1Schema.shape) {
            form1.setError(field as keyof Step1, { type: 'server', message: detail.message });
          } else if (field in step2BaseSchema.shape) {
            form2.setError(field as keyof Step2, { type: 'server', message: detail.message });
          }
        });
        return;
      }
      const messages: Record<string, string> = {
        EMAIL_EXISTS: 'This email is already registered. Try logging in instead.',
        PHONE_EXISTS: 'This phone number is already registered.',
      };
      setError(messages[code] || 'Registration failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  }

  function continueToEmailVerification(skipForNow: boolean) {
    if (!registeredUserId) return;
    if (!skipForNow && typeof window !== 'undefined') {
      sessionStorage.setItem(
        'registration_identity_draft',
        JSON.stringify({
          nationality: step1Data?.nationality || 'NG',
          ...identityData,
        })
      );
    }
    router.push(`/verify-email?userId=${encodeURIComponent(registeredUserId)}`);
  }

  const identityRequirement = step1Data
    ? {
        NG: { label: 'National Identification Number (NIN)', hint: '11 digits e.g. 71234567890' },
        UG: { label: 'Ndaga Muntu National ID', hint: '14 characters' },
        KE: { label: 'Kenyan National ID', hint: '8 digits' },
        GH: { label: 'Ghana Card Number', hint: 'GHA-123456789-0' },
        ZA: { label: 'South African ID Number', hint: '13 digits' },
      }[step1Data.nationality]
    : { label: 'National ID', hint: '' };

  return (
    <Card>
      <div className="mb-6">
        <div className="w-full bg-border rounded-full h-1.5 mb-4">
          <div
            className="bg-brand-amber h-1.5 rounded-full transition-all duration-300"
            style={{ width: step === 1 ? '34%' : step === 2 ? '67%' : '100%' }}
          />
        </div>
        <h2 className="font-display text-xl font-semibold text-text-primary">
          {step === 1 ? 'Create your account' : step === 2 ? 'Almost there!' : 'Identity verification (optional)'}
        </h2>
        <p className="text-sm text-text-muted mt-1">Step {step} of 3</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-btn text-sm text-error">{error}</div>
      )}

      {step === 1 ? (
        <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
          <Input label="First Name" {...form1.register('firstName')} error={form1.formState.errors.firstName?.message} />
          <Input label="Last Name" {...form1.register('lastName')} error={form1.formState.errors.lastName?.message} />
          <Input label="Email Address" type="email" {...form1.register('email')} error={form1.formState.errors.email?.message} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-primary">Country</label>
            <select
              {...form1.register('nationality')}
              className="w-full px-3 py-2.5 rounded-btn border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber text-text-primary"
            >
              <option value="">Select your country</option>
              <option value="NG">🇳🇬 Nigeria</option>
              <option value="UG">🇺🇬 Uganda</option>
              <option value="KE">🇰🇪 Kenya</option>
              <option value="GH">🇬🇭 Ghana</option>
              <option value="ZA">🇿🇦 South Africa</option>
            </select>
            {form1.formState.errors.nationality && (
              <p className="text-sm text-error">{form1.formState.errors.nationality.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full">Continue</Button>
        </form>
      ) : step === 2 ? (
        <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-primary">Phone Number</label>
            <div className="flex gap-2">
              <select
                {...form2.register('countryCode')}
                className="w-40 px-3 py-2.5 rounded-btn border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber text-text-primary"
              >
                {PHONE_COUNTRY_OPTIONS.map((option) => (
                  <option key={option.nationality} value={option.dialCode}>
                    {option.flag} {option.dialCode}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="8012345678"
                {...form2.register('localPhone')}
                className="flex-1 px-3 py-2.5 rounded-btn border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber text-text-primary"
              />
            </div>
            {form2.formState.errors.countryCode && (
              <p className="text-sm text-error">{form2.formState.errors.countryCode.message}</p>
            )}
            {form2.formState.errors.localPhone && (
              <p className="text-sm text-error">{form2.formState.errors.localPhone.message}</p>
            )}
          </div>
          <Input label="Password" type="password" {...form2.register('password')} error={form2.formState.errors.password?.message} />
          <Input
            label="Confirm Password"
            type="password"
            {...form2.register('confirmPassword')}
            error={form2.formState.errors.confirmPassword?.message}
          />
          {confirmPasswordValue ? (
            <p className={`text-xs ${confirmPasswordMatches ? 'text-success' : 'text-error'}`}>
              {confirmPasswordMatches ? '✅ Passwords match' : '❌ Passwords do not match'}
            </p>
          ) : null}
          <ul className="space-y-1 text-xs">
            {passwordChecks.map((check) => (
              <li key={check.label} className={check.met ? 'text-success' : 'text-error'}>
                {check.met ? '✅' : '❌'} {check.label}
              </li>
            ))}
          </ul>
          <Button type="submit" loading={loading} disabled={loading} className="w-full">Create Account</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)}>Back</Button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Verify your identity now to unlock higher limits immediately, or skip and do it later in your dashboard.
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">{identityRequirement.label}</label>
            <input
              value={identityData.idNumber}
              onChange={(e) => setIdentityData((prev) => ({ ...prev, idNumber: e.target.value }))}
              placeholder={identityRequirement.hint}
              className="w-full px-3 py-2.5 rounded-btn border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber text-text-primary"
            />
            <p className="text-xs text-text-muted">{identityRequirement.hint}</p>
          </div>
          <Input
            label="First Name"
            value={identityData.firstName}
            onChange={(e) => setIdentityData((prev) => ({ ...prev, firstName: e.target.value }))}
          />
          <Input
            label="Last Name"
            value={identityData.lastName}
            onChange={(e) => setIdentityData((prev) => ({ ...prev, lastName: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-primary">Date of Birth</label>
            <input
              type="date"
              value={identityData.dateOfBirth}
              onChange={(e) => setIdentityData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-btn border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber text-text-primary"
            />
          </div>
          <p className="text-xs text-text-muted">
            Your ID number is encrypted and never stored in plain text. We only use it to verify your identity.
          </p>
          <Button type="button" className="w-full" onClick={() => continueToEmailVerification(false)}>
            Verify Now
          </Button>
          <button
            type="button"
            className="w-full text-sm text-brand-amber hover:underline"
            onClick={() => continueToEmailVerification(true)}
          >
            Skip for now
          </button>
        </div>
      )}

      <p className="text-center text-sm text-text-muted mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-amber hover:underline font-medium">Log in</Link>
      </p>
    </Card>
  );
}
