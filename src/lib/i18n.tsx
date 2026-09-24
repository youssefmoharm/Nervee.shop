/**
 * Lightweight i18n — no external dependency.
 *
 * - English source strings are the keys (missing ar entries fall back to en)
 * - Locale persisted in localStorage ('nerve.locale')
 * - On locale change: sets <html lang> and <dir> (rtl for Arabic)
 * - formatEGP/formatNumber (src/lib/format.ts) already switch on this locale
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getAppLocale, setAppLocale, type AppLocale } from './format';
import { ar } from '../locales/ar';

export type { AppLocale };

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  /** Translate: returns Arabic when a mapping exists, otherwise the English key. */
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function applyDocumentLang(locale: AppLocale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => getAppLocale());

  useEffect(() => {
    applyDocumentLang(locale);
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    setAppLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string) => {
      if (locale !== 'ar') return key;
      return ar[key] ?? key;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe default so components outside the provider (tests) still work.
    return {
      locale: 'en',
      setLocale: () => undefined,
      t: (key: string) => key,
    };
  }
  return ctx;
}
