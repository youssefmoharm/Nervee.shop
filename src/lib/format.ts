/**
 * Currency + number formatting (English-only).
 *
 * formatEGP is the single EGP formatter for the whole app:
 * Intl.NumberFormat('en-US', …) with an "EGP" prefix (matches the
 * existing "EGP 1,234" copy).
 */

const enFormatters = new Map<string, Intl.NumberFormat>();

function getFormatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let fmt = enFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', options);
    enFormatters.set(key, fmt);
  }
  return fmt;
}

/** Format an amount in Egyptian pounds. */
export function formatEGP(amount: number): string {
  if (!Number.isFinite(amount)) return 'EGP 0';

  const formatted = getFormatter({
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  return `EGP ${formatted}`;
}

/** Bare number (no currency symbol). */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return getFormatter({
    style: 'decimal',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}
