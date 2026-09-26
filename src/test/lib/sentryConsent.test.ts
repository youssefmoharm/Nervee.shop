/**
 * OPS-01: Sentry must initialize in error-only mode before cookie consent
 * (so crashes are captured) and only switch on performance sampling and
 * interaction breadcrumbs after consent is granted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  getClient: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('@sentry/react', () => ({
  init: mocks.init,
  getClient: mocks.getClient,
  addBreadcrumb: mocks.addBreadcrumb,
}));

type SentryModule = typeof import('../../lib/sentry');
type InitOptions = NonNullable<Parameters<typeof import('@sentry/react').init>[0]>;

function options(): InitOptions {
  return mocks.init.mock.calls[0][0] as InitOptions;
}

type SendFn = (event: unknown, hint?: unknown) => unknown;
type CrumbFn = (breadcrumb: unknown, hint?: unknown) => unknown;

function send(event: unknown): unknown {
  return (options().beforeSend as unknown as SendFn)(event, {});
}

function crumb(breadcrumb: unknown): unknown {
  return (options().beforeBreadcrumb as unknown as CrumbFn)(breadcrumb, {});
}

describe('Sentry consent gating (OPS-01)', () => {
  let sentry: SentryModule;
  let liveOptions: { tracesSampleRate?: number };

  beforeEach(async () => {
    vi.resetModules();
    mocks.init.mockReset();
    mocks.getClient.mockReset();
    mocks.addBreadcrumb.mockReset();
    liveOptions = {};
    mocks.getClient.mockReturnValue({ getOptions: () => liveOptions });
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.sentry.io/0');
    vi.stubEnv('VITE_ENV', 'production');
    sentry = await import('../../lib/sentry');
  });

  it('initializes in error-only mode before consent', async () => {
    await sentry.initSentry({ consent: false });

    expect(mocks.init).toHaveBeenCalledTimes(1);
    const opts = options();
    expect(opts.tracesSampleRate).toBe(0);
    // Error events still flow (capture gap closed) …
    const errEvent = { exception: { values: [{ type: 'TypeError' }] } };
    expect(send(errEvent)).toEqual(errEvent);
    // … but transactions and interaction breadcrumbs do not.
    expect(send({ type: 'transaction' })).toBeNull();
    expect(crumb({ category: 'ui.click' })).toBeNull();
    expect(crumb({ category: 'console' })).toEqual({ category: 'console' });
  });

  it('raises the live sample rate once consent is granted, without re-initing', async () => {
    await sentry.initSentry({ consent: false });
    await sentry.initSentry({ consent: true });

    expect(mocks.init).toHaveBeenCalledTimes(1);
    expect(liveOptions.tracesSampleRate).toBe(0.1); // production rate
    expect(send({ type: 'transaction' })).toEqual({ type: 'transaction' });
  });

  it('gates trackPerformance breadcrumbs on consent', async () => {
    await sentry.initSentry({ consent: false });
    sentry.trackPerformance('LCP', 1200);
    expect(mocks.addBreadcrumb).not.toHaveBeenCalled();

    await sentry.initSentry({ consent: true });
    sentry.trackPerformance('LCP', 1200);
    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Performance: LCP' }),
    );
  });
});
