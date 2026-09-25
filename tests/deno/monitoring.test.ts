/**
 * OPS-02: edge monitoring must forward failures to Sentry when a DSN is set,
 * stay a silent no-op when it isn't, and never let alerting break a request.
 *
 * Run: npm run test:deno
 */

import {
  logEvent,
  parseSentryDsn,
  sendToSentry,
} from '../../supabase/functions/_shared/monitoring.ts';

function clearDsn() {
  Deno.env.delete('SENTRY_DSN');
  Deno.env.delete('VITE_SENTRY_DSN');
}

function stubFetch(handler: (url: string, init?: RequestInit) => void) {
  const original = globalThis.fetch;
  globalThis.fetch = ((url: unknown, init?: RequestInit) => {
    handler(String(url), init);
    return Promise.resolve(new Response('', { status: 200 }));
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

Deno.test('parseSentryDsn extracts key, origin and project id', () => {
  const parsed = parseSentryDsn('https://abc123@o456.ingest.sentry.io/789');
  if (!parsed) throw new Error('expected a valid DSN to parse');
  if (parsed.publicKey !== 'abc123') throw new Error(`bad key: ${parsed.publicKey}`);
  if (parsed.origin !== 'https://o456.ingest.sentry.io') {
    throw new Error(`bad origin: ${parsed.origin}`);
  }
  if (parsed.projectId !== '789') throw new Error(`bad project: ${parsed.projectId}`);

  if (parseSentryDsn('not-a-url')) throw new Error('garbage DSN should not parse');
  if (parseSentryDsn('https://host.example/42')) {
    throw new Error('DSN without a public key should not parse');
  }
});

Deno.test('sendToSentry is a no-op when no DSN is configured', async () => {
  clearDsn();
  let called = false;
  const restore = stubFetch(() => {
    called = true;
  });
  try {
    await sendToSentry({ type: 'error', category: 'TEST', message: 'no dsn' });
  } finally {
    restore();
  }
  if (called) throw new Error('fetch must not run without a DSN');
});

Deno.test('sendToSentry posts a well-formed Sentry envelope', async () => {
  Deno.env.set('SENTRY_DSN', 'https://key123@host.example/42');
  let captured: { url: string; init?: RequestInit } | null = null;
  const restore = stubFetch((url, init) => {
    captured = { url, init };
  });
  try {
    await sendToSentry({
      type: 'error',
      category: 'ORDER_PLACEMENT',
      message: 'Order failed: out of stock',
      correlationId: 'req_123',
      data: { customerId: 'c-1' },
    });
  } finally {
    restore();
    clearDsn();
  }

  if (!captured) throw new Error('expected a fetch call');
  const { url, init } = captured as { url: string; init?: RequestInit };
  if (url !== 'https://host.example/api/42/envelope/') throw new Error(`bad url: ${url}`);

  const headers = (init?.headers || {}) as Record<string, string>;
  if (!headers['x-sentry-auth']?.includes('sentry_key=key123')) {
    throw new Error(`missing auth header: ${headers['x-sentry-auth']}`);
  }
  if (headers['content-type'] !== 'application/x-sentry-envelope') {
    throw new Error(`bad content-type: ${headers['content-type']}`);
  }

  const lines = String(init?.body).split('\n');
  if (lines.length !== 3) throw new Error(`envelope must have 3 lines, got ${lines.length}`);
  const envelopeHeader = JSON.parse(lines[0]);
  const itemHeader = JSON.parse(lines[1]);
  const payload = JSON.parse(lines[2]);
  if (!envelopeHeader.event_id || !envelopeHeader.sent_at) {
    throw new Error('envelope header missing event_id/sent_at');
  }
  if (itemHeader.type !== 'event') throw new Error(`bad item type: ${itemHeader.type}`);
  if (payload.level !== 'error') throw new Error(`bad level: ${payload.level}`);
  if (payload.message !== 'Order failed: out of stock') {
    throw new Error(`bad message: ${payload.message}`);
  }
  if (payload.tags?.category !== 'ORDER_PLACEMENT') {
    throw new Error(`bad category tag: ${payload.tags?.category}`);
  }
  if (payload.tags?.correlation_id !== 'req_123') {
    throw new Error(`bad correlation tag: ${payload.tags?.correlation_id}`);
  }
});

Deno.test('logEvent forwards error/warning events but not info', async () => {
  Deno.env.set('SENTRY_DSN', 'https://key123@host.example/42');
  const levels: string[] = [];
  const restore = stubFetch((_url, init) => {
    const lines = String(init?.body).split('\n');
    levels.push(JSON.parse(lines[2]).level);
  });
  try {
    logEvent({ type: 'error', category: 'EMAIL', message: 'Email failed' });
    logEvent({ type: 'warning', category: 'INVENTORY', message: 'Low stock' });
    logEvent({ type: 'info', category: 'EMAIL', message: 'Email sent' });
    await settle();
  } finally {
    restore();
    clearDsn();
  }

  if (levels.length !== 2) throw new Error(`expected 2 forwards, got ${levels.length}`);
  if (levels[0] !== 'error' || levels[1] !== 'warning') {
    throw new Error(`unexpected levels: ${levels.join(', ')}`);
  }
});

Deno.test('sendToSentry never throws when the endpoint fails', async () => {
  Deno.env.set('SENTRY_DSN', 'https://key123@host.example/42');
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error('network down'))) as typeof fetch;
  try {
    await sendToSentry({ type: 'error', category: 'TEST', message: 'boom' });
  } catch (err) {
    globalThis.fetch = original;
    clearDsn();
    throw new Error(`sendToSentry must swallow transport errors, got: ${String(err)}`);
  } finally {
    globalThis.fetch = original;
    clearDsn();
  }
});
