'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { OTPInput } from '@/components/ui/OTPInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

function VerifyEmailPageContent() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  const userIdFromUrl = searchParams.get('userId');
  const token = searchParams.get('token');
  const userIdFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('verify_userId') : null;
  const userId = userIdFromUrl || userIdFromStorage;

  const storedEmail = typeof window !== 'undefined' ? sessionStorage.getItem('verify_email') || '' : '';
  const maskedEmail = storedEmail
    ? storedEmail.replace(/^(.).*(@.+)$/, (_match, first, domain) => `${first}***${domain}`)
    : 'your email';

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (userIdFromUrl && typeof window !== 'undefined') {
      sessionStorage.setItem('verify_userId', userIdFromUrl);
    }
  }, [userIdFromUrl]);

  useEffect(() => {
    if (otp.length === 6 && userId) handleVerify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, userId]);

  useEffect(() => {
    if (!token || !userId || loading) return;
    void verifyMagicLink(token, userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  async function verifyMagicLink(magicToken: string, id: string) {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await api.auth.verifyEmailLink(magicToken, id);
      if (res.data?.verified) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('verify_userId', id);
        }
        if (res.data?.alreadyVerified) {
          router.push('/login');
          return;
        }
        router.push('/login?verified=true');
        return;
      }
      setError('Verification link is invalid or expired. Please request a new one.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; message?: string } } };
      const code = e?.response?.data?.error || '';
      if (code === 'EMAIL_ALREADY_VERIFIED') {
        setInfo('Email already verified. Please log in.');
        router.push('/login');
        return;
      }
      setError(
        e?.response?.data?.message ||
        'Verification link is invalid or expired. Please request a new one.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!userId) {
      setError('We could not find your verification session. Enter your email below to resend verification.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await api.auth.verifyEmail({ userId, otp });
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('verify_userId', userId);
      }
      router.push('/login?verified=true');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; message?: string } } };
      const code = e?.response?.data?.error || '';
      if (code === 'OTP_EXPIRED') {
        setError('Your code has expired.');
      } else if (code === 'EMAIL_ALREADY_VERIFIED') {
        setInfo('Email already verified. Please log in.');
        router.push('/login');
        return;
      } else {
        setError(e?.response?.data?.message || 'Invalid code. Please try again.');
      }
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setInfo('');
    try {
      const payload = userId ? { userId } : { email: emailInput };
      if (!payload.userId && !emailInput) {
        setError('Enter your email to resend verification.');
        return;
      }
      const response = await api.auth.resendOTP(payload);
      const resolvedUserId = response.data?.userId as string | undefined;
      if (resolvedUserId && typeof window !== 'undefined') {
        sessionStorage.setItem('verify_userId', resolvedUserId);
      }
      setCooldown(60);
      setInfo('Verification email sent! Check your inbox.');
    } catch {
      setError('Failed to resend verification email.');
    }
  }

  return (
    <Card>
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">📧</div>
        <h2 className="font-display text-xl font-semibold text-text-primary">Check your email</h2>
        <p className="text-sm text-text-muted mt-2">We sent a 6-digit code to {maskedEmail}.</p>
        <p className="text-xs text-text-muted mt-1">Check your spam folder if you don&apos;t see it.</p>
        <p className="text-xs text-text-muted mt-2">Or click the link in your email to verify instantly.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-btn text-sm text-error text-center">{error}</div>
      )}
      {info && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-btn text-sm text-success text-center">{info}</div>
      )}

      {!userId && (
        <div className="mb-4">
          <label className="text-sm font-medium text-text-primary block mb-1">Enter your email to resend verification</label>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="w-full px-3 py-2.5 rounded-btn border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-brand-amber text-text-primary"
            placeholder="you@example.com"
          />
        </div>
      )}

      <OTPInput value={otp} onChange={setOtp} />

      <Button onClick={handleVerify} loading={loading} disabled={otp.length !== 6} className="w-full mt-6">
        Verify Email
      </Button>

      <div className="text-center mt-4">
        {cooldown > 0 ? (
          <p className="text-sm text-text-muted">Resend in {cooldown}s</p>
        ) : (
          <button onClick={handleResend} className="text-sm text-brand-amber hover:underline">
            {error.includes('expired') ? 'Send new code' : 'Resend code'}
          </button>
        )}
      </div>
      <p className="text-center text-xs text-text-muted mt-6">
        Need help? Contact Axios Pay at{' '}
        <a href="mailto:axiosbuild@gmail.com" className="text-brand-amber hover:underline">axiosbuild@gmail.com</a>
      </p>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Card><p className="text-sm text-text-muted">Loading...</p></Card>}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}
