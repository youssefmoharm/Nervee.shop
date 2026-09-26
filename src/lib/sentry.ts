/**
 * Sentry Error Tracking Configuration
 *
 * Uses dynamic import for @sentry/react to avoid crashing the entire app if
 * the package has module-level side effects or compatibility issues (v10+).
 * All Sentry API calls are gated behind a lazy-loaded module reference.
 */

declare const __APP_VERSION__: string;

const VERSION = __APP_VERSION__;

// Lazily-loaded Sentry module — never imported at the top level.
let SentryMod: typeof import('@sentry/react') | null = null;
let sentryEnabled = false;
/**
 * OPS-01: Sentry initializes on mount in error-only mode (no performance
 * sampling, no transaction events, no interaction breadcrumbs) until cookie
 * consent is granted; after consent the live client's sample rate is raised.
 */
let consentGranted = false;
let initialized = false;

function perfSampleRate(): number {
  const environment = import.meta.env.VITE_ENV || 'development';
  return environment === 'production' ? 0.1 : 1.0;
}

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

export async function initSentry(options?: { consent?: boolean }) {
  if (options?.consent !== undefined) consentGranted = options.consent;

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

  if (initialized) {
    // Consent can be granted after the first (error-only) init: tracesSampleRate
    // is mutable on the live client, so switch performance capture on without
    // re-running Sentry.init. Event/breadcrumb filtering reads consentGranted
    // live, so no re-init is needed there either.
    const opts = Sentry.getClient()?.getOptions();
    if (opts) opts.tracesSampleRate = consentGranted ? perfSampleRate() : 0;
    return;
  }
  initialized = true;

  Sentry.init({
    dsn,
    environment,
    release: environment === 'production' ? `v${VERSION}` : undefined,
    // Error-only before consent: no performance sampling (OPT-IN analytics).
    tracesSampleRate: consentGranted ? perfSampleRate() : 0,
    beforeSend(event) {
      if (event.exception?.values?.[0]?.type === 'AbortError') {
        return null;
      }
      // Belt-and-braces: never ship transaction (performance) data pre-consent.
      if (!consentGranted && event.type === 'transaction') {
        return null;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Interaction breadcrumbs are behavioural data — consent required.
      if (
        !consentGranted &&
        (breadcrumb.category === 'ui.click' || breadcrumb.category === 'ui.hover')
      ) {
        return null;
      }
      return breadcrumb;
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
  if (!SentryMod || !sentryEnabled || !consentGranted) return;
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
