/**
 * Sentry Error Tracking Configuration
 *
 * Setup:
 * 1. Create account at sentry.io
 * 2. Create new project (React)
 * 3. Copy DSN to .env: VITE_SENTRY_DSN
 * 4. Add environment: VITE_ENV=development|production
 */

import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_ENV || 'development';

  if (!dsn) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    setSentryEnabled(false);
    return;
  }

  setSentryEnabled(true);

  Sentry.init({
    dsn,
    environment,
    // Capture 100% of errors in development, 10% in production
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Filter out cancelled network requests
      if (event.exception?.values?.[0]?.type === 'AbortError') {
        return null;
      }
      return event;
    },
  });
}

/**
 * Track custom errors with context
 */
export function trackError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    contexts: { custom: context },
  });
}

/**
 * Track performance issues
 */
export function trackPerformance(name: string, value: number) {
  Sentry.addBreadcrumb({
    message: `Performance: ${name}`,
    data: { value },
    level: 'info',
  });
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, email?: string) {
  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Track custom events
 */
export function trackEvent(name: string, data?: Record<string, any>) {
  Sentry.captureMessage(name, {
    level: 'info',
    extra: data,
  });
}

let sentryEnabled = false;

export function isSentryEnabled() {
  return sentryEnabled;
}

/**
 * Central error logger. Always logs to the console for local debugging, and
 * forwards to Sentry when VITE_SENTRY_DSN is configured. Use this instead of
 * bare `console.error` in production code paths.
 */
export function logError(message: unknown, error?: unknown, context?: Record<string, any>) {
  // Always keep a console trace for local debugging.
  if (error) {
    console.error(message, error);
  } else {
    console.error(message);
  }

  if (!sentryEnabled) return;

  const err = error instanceof Error ? error : message instanceof Error ? message : undefined;
  if (err) {
    Sentry.captureException(err, {
      contexts: { custom: context ?? {} },
    });
  } else {
    Sentry.captureMessage(String(message), {
      level: 'warning',
      extra: { error, context },
    });
  }
}

export function setSentryEnabled(enabled: boolean) {
  sentryEnabled = enabled;
}
