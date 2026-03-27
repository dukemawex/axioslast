'use client';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach access token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('axiospay-auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        const token = parsed?.state?.accessToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // ignore
    }
  }
  return config;
});

// Response interceptor — handle 401 and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      error.response?.data?.error === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const stored = localStorage.getItem('axiospay-auth');
        const parsed = stored ? JSON.parse(stored) : null;
        const refreshToken = parsed?.state?.refreshToken;

        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refreshToken });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

        // Update store
        const { useAuthStore } = await import('@/store/authStore');
        const store = useAuthStore.getState();
        store.setAccessToken(newAccessToken);
        if (store.user) {
          store.setAuth(store.user, newAccessToken, newRefreshToken);
        }

        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        const { useAuthStore } = await import('@/store/authStore');
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const api = {
  auth: {
    register: (data: unknown) => apiClient.post('/auth/register', data),
    verifyEmail: (data: unknown) => apiClient.post('/auth/verify-email', data),
    verifyPhone: (data: unknown) => apiClient.post('/auth/verify-phone', data),
    login: (data: unknown) => apiClient.post('/auth/login', data),
    refresh: (data: unknown) => apiClient.post('/auth/refresh', data),
    logout: (data: unknown) => apiClient.post('/auth/logout', data),
    forgotPassword: (data: unknown) => apiClient.post('/auth/forgot-password', data),
    resetPassword: (data: unknown) => apiClient.post('/auth/reset-password', data),
    resendOTP: (data: unknown) => apiClient.post('/auth/resend-otp', data),
    verify2FA: (data: unknown) => apiClient.post('/auth/2fa/verify', data),
  },
  users: {
    getMe: () => apiClient.get('/users/me'),
    updateMe: (data: unknown) => apiClient.patch('/users/me', data),
    updateLimits: (data: unknown) => apiClient.patch('/users/limits', data),
    freeze: (data: unknown) => apiClient.post('/users/freeze', data),
    requestUnfreezeOtp: () => apiClient.post('/users/unfreeze/request-otp'),
    unfreeze: (data: unknown) => apiClient.post('/users/unfreeze', data),
  },
  wallets: {
    getAll: () => apiClient.get('/wallets'),
    initiateDeposit: (data: unknown) => apiClient.post('/wallets/deposit/initiate', data),
    verifyDeposit: (reference: string) => apiClient.get(`/wallets/deposit/verify/${reference}`),
    swap: (data: unknown, pinToken?: string) =>
      apiClient.post('/wallets/swap', data, {
        headers: pinToken ? { 'X-Pin-Token': pinToken } : undefined,
      }),
    getTransactions: (params?: Record<string, unknown>) => apiClient.get('/wallets/transactions', { params }),
    getTransaction: (id: string) => apiClient.get(`/wallets/transactions/${id}`),
    createRecurring: (data: unknown) => apiClient.post('/wallets/recurring', data),
    listRecurring: () => apiClient.get('/wallets/recurring'),
    cancelRecurring: (id: string) => apiClient.delete(`/wallets/recurring/${id}`),
    requestRefund: (data: unknown) => apiClient.post('/wallets/refund', data),
    createPaymentLink: (data: unknown) => apiClient.post('/wallets/payment-links', data),
    listPaymentLinks: () => apiClient.get('/wallets/payment-links'),
    deactivatePaymentLink: (id: string) => apiClient.delete(`/wallets/payment-links/${id}`),
    getBanks: () => apiClient.get('/wallets/transfers/banks'),
    resolveBankAccount: (data: unknown) => apiClient.post('/wallets/transfers/resolve', data),
    sendTransfer: (data: TransferRequest, pinToken?: string) =>
      apiClient.post('/wallets/transfers/send', data, {
        headers: pinToken ? { 'X-Pin-Token': pinToken } : undefined,
      }),
    generatePaycode: (data: unknown) => apiClient.post('/wallets/paycodes', data),
    listPaycodes: () => apiClient.get('/wallets/paycodes'),
  },
  rates: {
    getAll: () => apiClient.get('/rates'),
    getRate: (from: string, to: string) => apiClient.get(`/rates/${from}/${to}`),
    getHealth: () => apiClient.get('/rates/health'),
    refreshAll: () => apiClient.post('/rates/refresh'),
  },
  pin: {
    set: (data: unknown) => apiClient.post('/pin/set', data),
    verify: (data: unknown) => apiClient.post('/pin/verify', data),
    change: (data: unknown) => apiClient.post('/pin/change', data),
  },
  twoFactor: {
    setup: () => apiClient.post('/2fa/setup'),
    enable: (data: unknown) => apiClient.post('/2fa/enable', data),
    verify: (data: unknown) => apiClient.post('/2fa/verify', data),
    disable: (data: unknown) => apiClient.post('/2fa/disable', data),
  },
  bills: {
    airtime: (data: unknown, pinToken?: string) =>
      apiClient.post('/bills/airtime', data, {
        headers: pinToken ? { 'X-Pin-Token': pinToken } : undefined,
      }),
    categories: () => apiClient.get('/bills/categories'),
    billers: (categoryId: string) => apiClient.get(`/bills/billers/${categoryId}`),
    validate: (data: unknown) => apiClient.post('/bills/validate', data),
    pay: (data: unknown, pinToken?: string) =>
      apiClient.post('/bills/pay', data, {
        headers: pinToken ? { 'X-Pin-Token': pinToken } : undefined,
      }),
  },
};

interface TransferRequest {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  narration?: string;
}
