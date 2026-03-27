'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, ArrowLeftRight, Wallet, CreditCard, User, LogOut, Bell, ShieldCheck, Plane, Gift, Lock, Building2, Menu, X, Landmark, ReceiptText, Link2 } from 'lucide-react';
import { PINSetupModal } from '@/components/PINSetupModal';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/swap', icon: ArrowLeftRight, label: 'Swap' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/deposit', icon: CreditCard, label: 'Deposit' },
  { href: '/withdraw', icon: Landmark, label: 'Withdraw' },
  { href: '/bills', icon: ReceiptText, label: 'Bills' },
  { href: '/payment-links', icon: Link2, label: 'Payment Links' },
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

const MOBILE_PRIMARY_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/swap', icon: ArrowLeftRight, label: 'Swap' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/cards', icon: CreditCard, label: 'Cards' },
  { href: '/profile', icon: User, label: 'Profile' },
];

const NATIONALITY_FLAGS: Record<string, string> = {
  NG: '🇳🇬', UG: '🇺🇬', KE: '🇰🇪', GH: '🇬🇭', ZA: '🇿🇦',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      <aside className="hidden md:flex w-20 lg:w-60 bg-navy flex-col fixed h-full z-20">
        <div className="p-6 border-b border-white/10">
          <p className="font-display font-bold text-white text-lg hidden lg:block">Axios Pay</p>
          <p className="text-xs text-white/40 hidden lg:block">Cross-Border FX, Unlocked.</p>
          <p className="font-display font-bold text-white text-center text-lg lg:hidden">AP</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }, index) => {
            const active = pathname === href;
            return (
              <Link
                key={`${href}-${index}`}
                href={href}
                className={`min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-all duration-200 border-l-2 ${active ? 'border-brand-amber text-brand-amber bg-white/5' : 'border-transparent text-white/60 hover:text-white hover:bg-white/10'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 hidden lg:block">
          <div className="flex items-center gap-3 mb-3 min-w-0">
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

      {/* Top bar */}
      <header className="fixed top-0 right-0 left-0 md:left-20 lg:left-60 z-30 bg-page/95 backdrop-blur border-b border-border">
        <div className="h-14 px-4 md:px-6 flex items-center justify-between relative">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden min-h-11 min-w-11 flex items-center justify-start text-text-primary transition-all duration-200"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
          <p className="font-display text-lg text-text-primary absolute left-1/2 -translate-x-1/2 md:static md:left-auto md:translate-x-0">
            Axios Pay
          </p>
          <div className="flex items-center justify-end gap-2">
            <Link href="/notifications" className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-text-primary transition-all duration-200 hover:bg-subtle">
              <Bell className="w-5 h-5" />
            </Link>
            <Link href="/profile" className="min-h-11 min-w-11 flex items-center justify-center rounded-full bg-brand-bg text-brand-amber font-semibold transition-all duration-200 hover:bg-brand-gold/20">
              {(user?.firstName?.[0] || 'U').toUpperCase()}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={`md:hidden fixed inset-0 z-40 transition-all duration-200 ${drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-black/40 transition-all duration-200 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setDrawerOpen(false)} />
        <div className={`absolute inset-0 bg-page p-4 pt-6 transition-all duration-200 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between mb-6">
            <p className="font-display text-xl text-text-primary">Menu</p>
            <button type="button" onClick={() => setDrawerOpen(false)} className="min-h-11 min-w-11 flex items-center justify-center text-text-primary">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="space-y-2">
            {NAV_ITEMS.map(({ href, icon: Icon, label }, index) => {
              const active = pathname === href;
              return (
                <Link
                  key={`mobile-${href}-${index}`}
                  href={href}
                  onClick={() => setDrawerOpen(false)}
                  className={`min-h-11 px-3 rounded-btn flex items-center gap-3 transition-all duration-200 border-l-2 ${active ? 'border-brand-amber text-brand-amber bg-brand-bg' : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-subtle'}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{label}</span>
                </Link>
              );
            })}
          </nav>
          <button onClick={handleLogout} className="min-h-11 mt-8 w-full flex items-center justify-center gap-2 rounded-btn border border-border text-text-secondary hover:text-text-primary transition-all duration-200">
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-20 flex">
        {MOBILE_PRIMARY_NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-1 text-xs transition-all duration-200 ${active ? 'text-brand-amber' : 'text-text-muted'}`}>
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main content */}
        <main className="flex-1 md:ml-20 lg:ml-60 p-4 md:p-6 pt-20 md:pt-6 pb-24 md:pb-6">
          {children}
          <p className="text-center text-xs text-text-muted mt-8">
            Complaints or support: <a href="mailto:axiosbuild@gmail.com" className="text-brand-amber hover:underline">axiosbuild@gmail.com</a>
          </p>
          <PINSetupModal open={!user?.isPinSet} />
        </main>
      </div>
  );
}
