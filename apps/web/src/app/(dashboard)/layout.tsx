'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, ArrowLeftRight, Wallet, CreditCard, User, LogOut, Bell, ShieldCheck, Plane, Gift, Lock, Building2 } from 'lucide-react';
import { PINSetupModal } from '@/components/PINSetupModal';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/swap', icon: ArrowLeftRight, label: 'Swap' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/deposit', icon: CreditCard, label: 'Deposit' },
  { href: '/rate-lock', icon: Lock, label: 'Lock Rate' },
  { href: '/alerts', icon: Bell, label: 'Rate Alerts' },
  { href: '/travel', icon: Plane, label: 'Travel History' },
  { href: '/referrals', icon: Gift, label: 'Referrals' },
  { href: '/cards', icon: CreditCard, label: 'Virtual Card' },
  { href: '/agent', icon: ShieldCheck, label: 'Agent Portal' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/profile', icon: User, label: 'Profile' },
  { href: '/profile/kyc', icon: ShieldCheck, label: 'KYC Verification' },
  { href: '/profile/2fa', icon: ShieldCheck, label: 'Two-Factor Auth' },
  { href: '/profile', icon: Lock, label: 'Transaction PIN' },
  { href: '/profile', icon: Wallet, label: 'Spending Limits' },
  { href: '/profile', icon: User, label: 'Freeze Account' },
  { href: '/business', icon: Building2, label: 'Business Account' },
];

const NATIONALITY_FLAGS: Record<string, string> = {
  NG: '🇳🇬', UG: '🇺🇬', KE: '🇰🇪', GH: '🇬🇭', ZA: '🇿🇦',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

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
    <div className="min-h-screen bg-page flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 bg-navy flex-col fixed h-full z-20">
        <div className="p-6 border-b border-white/10">
          <p className="font-display font-bold text-white text-lg">Axios Pay</p>
          <p className="text-xs text-white/40">Cross-Border FX, Unlocked.</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-colors ${active ? 'bg-brand-amber text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{NATIONALITY_FLAGS[user?.nationality || ''] || '👤'}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors w-full">
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-navy border-t border-white/10 z-20 flex">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors ${active ? 'text-brand-amber' : 'text-white/60'}`}>
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 md:ml-60 p-6 pb-24 md:pb-6">
        {children}
        <PINSetupModal open={!user?.isPinSet} />
      </main>
    </div>
  );
}
