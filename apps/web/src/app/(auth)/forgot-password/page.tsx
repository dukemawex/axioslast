'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { OTPInput } from '@/components/ui/OTPInput';

const emailSchema = z.object({ email: z.string().email('Valid email required') });
const resetSchema = z
  .object({
    otp: z.string().length(6),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm Password is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const emailForm = useForm<{ email: string }>({ resolver: zodResolver(emailSchema) });
  const resetForm = useForm<{ otp: string; newPassword: string; confirmPassword: string }>({
    resolver: zodResolver(resetSchema),
    mode: 'onChange',
  });
  const newPassword = resetForm.watch('newPassword', '');
  const confirmPassword = resetForm.watch('confirmPassword', '');
  const passwordMatch = confirmPassword.length > 0 && confirmPassword === newPassword;

  async function onEmailSubmit(data: { email: string }) {
    setLoading(true);
    setError('');
    try {
      await api.auth.forgotPassword(data);
      setEmail(data.email);
      setStep('reset');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onResetSubmit(data: { otp: string; newPassword: string }) {
    setLoading(true);
    setError('');
    try {
      await api.auth.resetPassword({ email, ...data });
      router.push('/login?reset=1');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const code = e?.response?.data?.error || '';
      setError(code === 'OTP_EXPIRED' ? 'Code expired.' : code === 'OTP_INVALID' ? 'Invalid code.' : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      {step === 'email' ? (
        <>
          <h2 className="font-display text-xl font-semibold text-text-primary mb-6">Reset your password</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-btn text-sm text-error">{error}</div>}
          <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
            <Input label="Email Address" type="email" {...emailForm.register('email')} error={emailForm.formState.errors.email?.message} />
            <Button type="submit" loading={loading} className="w-full">Send Reset Code</Button>
          </form>
        </>
      ) : (
        <>
          <h2 className="font-display text-xl font-semibold text-text-primary mb-2">Enter reset code</h2>
          <p className="text-sm text-text-muted mb-6">We sent a code to {email}</p>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-btn text-sm text-error">{error}</div>}
          <OTPInput value={otp} onChange={(v) => { setOtp(v); resetForm.setValue('otp', v); }} />
          <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4 mt-4">
            <input type="hidden" {...resetForm.register('otp')} />
            <Input label="New Password" type="password" {...resetForm.register('newPassword')} error={resetForm.formState.errors.newPassword?.message} />
            <Input label="Confirm Password" type="password" {...resetForm.register('confirmPassword')} error={resetForm.formState.errors.confirmPassword?.message} />
            {confirmPassword ? (
              <p className={`text-xs ${passwordMatch ? 'text-success' : 'text-error'}`}>
                {passwordMatch ? '✅ Passwords match' : '❌ Passwords do not match'}
              </p>
            ) : null}
            <Button type="submit" loading={loading} className="w-full">Reset Password</Button>
          </form>
        </>
      )}
    </Card>
  );
}
