/**
 * Sentry Error Tracking Configuration
 *
 * Uses dynamic import for @sentry/react to avoid crashing the entire app if
 * the package has module-level side effects or compatibility issues (v10+).
 * All Sentry API calls are gated behind a lazy-loaded module reference.
 */

const VERSION = '1.0.0';

// Lazily-loaded Sentry module — never imported at the top level.
let SentryMod: typeof import('@sentry/react') | null = null;
let sentryEnabled = false;

async function loadSentry(): Promise<typeof import('@sentry/react') | null> {
  if (SentryMod) return SentryMod;
  try {
    SentryMod = await import('@sentry/react');
    return SentryMod;
  } catch (err) {
    console.warn('[sentry] Failed to load @sentry/react:', err);
    return null;
  }
}

export function isSentryEnabled() {
  return sentryEnabled;
}

export function setSentryEnabled(enabled: boolean) {
  sentryEnabled = enabled;
}

export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_ENV || 'development';

  if (!dsn) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    sentryEnabled = false;
    return;
  }

  const Sentry = await loadSentry();
  if (!Sentry) {
    sentryEnabled = false;
    return;
  }

  sentryEnabled = true;

  Sentry.init({
    dsn,
    environment,
    release: environment === 'production' ? `v${VERSION}` : undefined,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.exception?.values?.[0]?.type === 'AbortError') {
        return null;
      }
      return event;
    },
  });
}

export function trackError(error: Error, context?: Record<string, any>) {
  if (!SentryMod || !sentryEnabled) return;
  SentryMod.captureException(error, {
    contexts: { custom: context },
  });
}

export function trackPerformance(name: string, value: number) {
  if (!SentryMod || !sentryEnabled) return;
  SentryMod.addBreadcrumb({
    message: `Performance: ${name}`,
    data: { value },
    level: 'info',
  });
}

export function setUserContext(userId: string, email?: string) {
  if (!SentryMod || !sentryEnabled) return;
  SentryMod.setUser({ id: userId, email });
}

export function clearUserContext() {
  if (!SentryMod || !sentryEnabled) return;
  SentryMod.setUser(null);
}

/**
 * Central error logger. Always logs to the console for local debugging, and
 * forwards to Sentry when VITE_SENTRY_DSN is configured.
 */
export function logError(message: unknown, error?: unknown, context?: Record<string, any>) {
  if (error) {
    console.error(message, error);
  } else {
    console.error(message);
  }

  if (!SentryMod || !sentryEnabled) return;

  const err = error instanceof Error ? error : message instanceof Error ? message : undefined;
  if (err) {
    SentryMod.captureException(err, {
      contexts: { custom: context ?? {} },
    });
  } else {
    SentryMod.captureMessage(String(message), {
      level: 'warning',
      extra: { error, context },
    });
  }
}
