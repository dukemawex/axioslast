export type CurrencyCode = 'NGN' | 'UGX' | 'KES' | 'GHS' | 'ZAR';
export type NationalityCode = 'NG' | 'UG' | 'KE' | 'GH' | 'ZA';

export const CURRENCY_META: Record<CurrencyCode, { flag: string; name: string }> = {
  NGN: { flag: '🇳🇬', name: 'Nigerian Naira' },
  UGX: { flag: '🇺🇬', name: 'Ugandan Shilling' },
  KES: { flag: '🇰🇪', name: 'Kenyan Shilling' },
  GHS: { flag: '🇬🇭', name: 'Ghanaian Cedi' },
  ZAR: { flag: '🇿🇦', name: 'South African Rand' },
};

export const PHONE_COUNTRY_OPTIONS: Array<{ nationality: NationalityCode; flag: string; dialCode: string }> = [
  { nationality: 'NG', flag: '🇳🇬', dialCode: '+234' },
  { nationality: 'UG', flag: '🇺🇬', dialCode: '+256' },
  { nationality: 'KE', flag: '🇰🇪', dialCode: '+254' },
  { nationality: 'GH', flag: '🇬🇭', dialCode: '+233' },
  { nationality: 'ZA', flag: '🇿🇦', dialCode: '+27' },
];

export const NATIONALITY_TO_DIAL_CODE: Record<NationalityCode, string> = PHONE_COUNTRY_OPTIONS.reduce(
  (acc, option) => {
    acc[option.nationality] = option.dialCode;
    return acc;
  },
  {} as Record<NationalityCode, string>
);

export const SUPPORTED_CORRIDORS: Array<{ from: CurrencyCode; to: CurrencyCode }> = [
  { from: 'NGN', to: 'UGX' },
  { from: 'NGN', to: 'KES' },
  { from: 'NGN', to: 'GHS' },
  { from: 'NGN', to: 'ZAR' },
  { from: 'UGX', to: 'KES' },
  { from: 'UGX', to: 'GHS' },
  { from: 'UGX', to: 'ZAR' },
  { from: 'KES', to: 'GHS' },
  { from: 'KES', to: 'ZAR' },
  { from: 'GHS', to: 'ZAR' },
];

export const DEFAULT_CORRIDOR_RATES: Record<string, string> = {
  'NGN-UGX': '10.85',
  'NGN-KES': '0.29',
  'NGN-GHS': '0.021',
  'NGN-ZAR': '0.052',
  'UGX-KES': '0.027',
  'UGX-GHS': '0.0026',
  'UGX-ZAR': '0.0047',
  'KES-GHS': '0.072',
  'KES-ZAR': '0.178',
  'GHS-ZAR': '2.47',
};

export function getCurrencyDisplay(code: string): string {
  const meta = CURRENCY_META[code as CurrencyCode];
  if (!meta) return code;
  return `${meta.flag} ${code} — ${meta.name}`;
}

export function getCurrencyNameDisplay(code: string): string {
  const meta = CURRENCY_META[code as CurrencyCode];
  if (!meta) return code;
  return `${meta.flag} ${meta.name}`;
}
