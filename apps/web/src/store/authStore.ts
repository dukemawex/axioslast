import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  nationality: string;
  kycStatus: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isPinSet?: boolean;
  isTwoFactorEnabled?: boolean;
  isFrozen?: boolean;
  dailySwapLimit?: string;
  dailySwapUsed?: string;
  dailyLimitResetAt?: string;
  createdAt?: string;
  wallets?: Array<{ id: string; currency: string; balance: string }>;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
      updateUser: (partial) =>
        set((state) => ({ user: state.user ? { ...state.user, ...partial } : null })),
      setAccessToken: (token) => set({ accessToken: token }),
    }),
    { name: 'axiospay-auth' }
  )
);
