import { describe, expect, it } from 'vitest';
import { formatMoney, parseAmount } from '../../src/lib/util/money';

describe('money', () => {
  it('parses user input into integer minor units', () => {
    expect(parseAmount('12.34', 'USD')).toBe(1234);
    expect(parseAmount('12,34', 'EUR')).toBe(1234);
    expect(parseAmount('1,234', 'USD')).toBe(123400);
    expect(parseAmount('1.234,56', 'EUR')).toBe(123456);
    expect(parseAmount('0.1', 'USD')).toBe(10);
    expect(parseAmount('1500', 'JPY')).toBe(1500);
    expect(parseAmount('12.5', 'JPY')).toBeNull();
    expect(parseAmount('abc', 'USD')).toBeNull();
    expect(parseAmount('', 'USD')).toBeNull();
    expect(parseAmount('1.234', 'USD')).toBe(123400);
  });
  it('avoids float drift when summing', () => {
    const cents = [parseAmount('0.1', 'USD')!, parseAmount('0.2', 'USD')!];
    expect(cents.reduce((a, b) => a + b, 0)).toBe(30);
  });
  it('formats with the currency', () => {
    expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
    expect(formatMoney(1500, 'JPY', 'en-US')).toBe('¥1,500');
  });
});
