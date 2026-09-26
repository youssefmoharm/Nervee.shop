/**
 * Lightweight i18n — English-only, no external dependency.
 *
 * - English source strings are the keys: t(key) renders the key itself.
 * - `vars` fills `{token}` placeholders (e.g. counts) in the copy.
 * - Language switching / RTL were removed with the Arabic locale; the
 *   document is static lang="en" dir="ltr" (see index.html).
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

/** Values substituted into `{token}` placeholders by {@link interpolate}. */
export type I18nVars = Record<string, string | number>;

/**
 * Replaces `{name}` placeholders with the supplied values. Unknown placeholders
 * are left untouched so a missing variable never renders as "undefined".
 */
export function interpolate(template: string, vars?: I18nVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : token,
  );
}

interface I18nContextValue {
  /** Translate: returns the English key with `{token}` placeholders filled in. */
  t: (key: string, vars?: I18nVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const t = useCallback((key: string, vars?: I18nVars) => interpolate(key, vars), []);

  const value = useMemo(() => ({ t }), [t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe default so components outside the provider (tests) still work.
    return { t: (key: string, vars?: I18nVars) => interpolate(key, vars) };
  }
  return ctx;
}
