// Money is stored as integer minor units (e.g. cents) + an ISO 4217 code. Never floats.

export interface Money {
  amountMinor: number;
  currency: string;
}

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'INR', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'ZAR',
  'SGD', 'HKD', 'AED', 'SAR', 'PKR', 'BRL', 'MXN', 'PHP', 'IDR', 'MYR', 'THB', 'NGN', 'KES', 'TRY',
] as const;

export function minorDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** "12.34" / "12,34" / "1,234.5" → minor units. Returns null for anything that isn't a clean amount. */
export function parseAmount(input: string, currency: string): number | null {
  const s = input.trim().replace(/[\s ']/g, '');
  if (!s) return null;
  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  const digits = minorDigits(currency);
  let whole = s, frac = '';
  // a trailing separator followed by 1–digits digits is the decimal separator; others are grouping
  if (lastSep !== -1 && s.length - lastSep - 1 <= Math.max(digits, 2) && s.length - lastSep - 1 > 0) {
    whole = s.slice(0, lastSep);
    frac = s.slice(lastSep + 1);
  }
  whole = whole.replace(/[.,]/g, '');
  if (!/^-?\d+$/.test(whole || '0') || !/^\d*$/.test(frac)) return null;
  if (frac.length > digits) return null;
  const sign = whole.startsWith('-') ? -1 : 1;
  const w = Math.abs(parseInt(whole || '0', 10));
  const f = parseInt((frac + '0'.repeat(digits)).slice(0, digits) || '0', 10);
  const v = sign * (w * 10 ** digits + f);
  return Number.isSafeInteger(v) ? v : null;
}

export function formatMoney(amountMinor: number, currency: string, locale?: string): string {
  const digits = minorDigits(currency);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / 10 ** digits);
  } catch {
    return `${(amountMinor / 10 ** digits).toFixed(digits)} ${currency}`;
  }
}

export function sumMinor(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Select options like "EUR — Euro", localized where the platform supports it. */
export function currencyOptions(): { value: string; label: string }[] {
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames(undefined, { type: 'currency' }); } catch { /* codes only */ }
  return CURRENCIES.map((c) => ({ value: c, label: names ? `${c} — ${names.of(c) ?? c}` : c }));
}
