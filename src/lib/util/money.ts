// Money is stored as integer minor units (e.g. cents) + an ISO 4217 code. Never floats.

export interface Money {
  amountMinor: number;
  currency: string;
}

/** The most-used currencies, shown first in the picker. */
export const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'AED'] as const;

export const CURRENCIES = [
  // popular
  'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'AED',
  // Americas
  'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'BOB', 'CRC', 'DOP', 'JMD',
  // Europe
  'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'ISK', 'RSD', 'UAH', 'RUB', 'TRY', 'GEL',
  // Middle East & Africa
  'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'ILS', 'EGP', 'MAD', 'TND', 'DZD', 'NGN', 'KES', 'GHS', 'TZS', 'UGX', 'ETB', 'ZAR',
  // Asia & Pacific
  'CNY', 'HKD', 'TWD', 'KRW', 'SGD', 'MYR', 'THB', 'VND', 'IDR', 'PHP', 'PKR', 'BDT', 'LKR', 'NPR', 'KZT', 'NZD',
] as const;

/** The symbol people write for a currency ("₹", "€", "£", "$"), or the code when the platform has none. */
export function currencySymbol(code: string, locale?: string): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/** "Indian Rupee" (localized where the platform supports it), or the code itself. */
export function currencyName(code: string, locale?: string): string {
  try { return new Intl.DisplayNames(locale, { type: 'currency' }).of(code) ?? code; } catch { return code; }
}

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
