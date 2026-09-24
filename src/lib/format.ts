/**
 * Locale-aware currency + date formatting.
 *
 * formatEGP is the single EGP formatter for the whole app:
 * - en locale → Intl.NumberFormat('en-US', …) with an "EGP" prefix (matches
 *   the existing "EGP 1,234" copy)
 * - ar locale → Intl.NumberFormat('ar-EG', …) which renders Eastern Arabic
 *   numerals and the ج.م. currency style per Egyptian conventions.
 */

export type AppLocale = 'en' | 'ar';

const STORAGE_KEY = 'nerve.locale';

export function getAppLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

export function setAppLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* non-fatal */
  }
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

const enFormatters = new Map<string, Intl.NumberFormat>();
const arFormatters = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: AppLocale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cache = locale === 'ar' ? arFormatters : enFormatters;
  const key = JSON.stringify(options);
  let fmt = cache.get(key);
  if (!fmt) {
    fmt =
      locale === 'ar'
        ? new Intl.NumberFormat('ar-EG', options)
        : new Intl.NumberFormat('en-US', options);
    cache.set(key, fmt);
  }
  return fmt;
}

/**
 * Format an amount in Egyptian pounds.
 * `locale` defaults to the active app locale.
 */
export function formatEGP(amount: number, locale: AppLocale = getAppLocale()): string {
  if (!Number.isFinite(amount)) return locale === 'ar' ? '٠ ج.م.' : 'EGP 0';

  if (locale === 'ar') {
    return getFormatter('ar', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  }

  const formatted = getFormatter('en', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  return `EGP ${formatted}`;
}

/** Bare number in the active locale (no currency symbol). */
export function formatNumber(value: number, locale: AppLocale = getAppLocale()): string {
  if (!Number.isFinite(value)) return '0';
  return getFormatter(locale, {
    style: 'decimal',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/** Detect Arabic-script queries so search can switch tsquery config. */
export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}
