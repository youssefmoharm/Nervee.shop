/**
 * Deno tests for rate-limit shared helpers.
 *
 * rateLimitIdentifier / clientIp are pure enough to exercise here: they take
 * a Request and an injected supabase-like client (auth.getUser only), so no
 * network or URL imports of supabase-js are involved.
 *
 * Run: deno test --allow-env supabase/functions/_shared/ratelimit.test.ts
 */
import { clientIp, rateLimitIdentifier, rateLimit, getRateLimitHeaders } from './ratelimit.ts';

function req(headers: Record<string, string>): Request {
  return new Request('https://example.test/', { headers });
}

/** Minimal collaborator stub: only auth.getUser is used by rateLimitIdentifier. */
function stubSupabase(userId: string | null) {
  return {
    auth: {
      getUser: async (_token: string) => {
        if (!userId) throw new Error('invalid JWT');
        return { data: { user: { id: userId } } };
      },
    },
  };
}

Deno.test('clientIp takes the LAST hop of X-Forwarded-For (trusted proxy append)', () => {
  const ip = clientIp(req({ 'x-forwarded-for': ' 1.1.1.1, 2.2.2.2, 9.9.9.9 ' }));
  if (ip !== '9.9.9.9') throw new Error(`expected last hop 9.9.9.9, got ${ip}`);
});

Deno.test('clientIp falls back to cf-connecting-ip, then x-real-ip, then anonymous', () => {
  if (clientIp(req({ 'cf-connecting-ip': '8.8.8.8' })) !== '8.8.8.8') {
    throw new Error('cf-connecting-ip should win without XFF');
  }
  if (clientIp(req({ 'x-real-ip': '7.7.7.7' })) !== '7.7.7.7') {
    throw new Error('x-real-ip should win without XFF/cf');
  }
  if (clientIp(req({})) !== 'anonymous') throw new Error('should fall back to anonymous');
});

Deno.test('rateLimitIdentifier prefers authenticated user id over IP', async () => {
  const identifier = await rateLimitIdentifier(
    req({ authorization: 'Bearer real-user-jwt', 'x-forwarded-for': '5.5.5.5' }),
    stubSupabase('user-abc'),
  );
  if (identifier !== 'user:user-abc') throw new Error(`expected user bucket, got ${identifier}`);
});

Deno.test('rateLimitIdentifier treats anon key as not-a-user (IP bucket)', async () => {
  const prev = Deno.env.get('SUPABASE_ANON_KEY');
  Deno.env.set('SUPABASE_ANON_KEY', 'anon-key-xyz');
  try {
    const identifier = await rateLimitIdentifier(
      req({ authorization: 'Bearer anon-key-xyz', 'x-forwarded-for': '5.5.5.5' }),
      stubSupabase('should-not-be-used'),
    );
    if (identifier !== 'ip:5.5.5.5') throw new Error(`expected ip bucket, got ${identifier}`);
  } finally {
    if (prev === undefined) Deno.env.delete('SUPABASE_ANON_KEY');
    else Deno.env.set('SUPABASE_ANON_KEY', prev);
  }
});

Deno.test('rateLimitIdentifier treats sb_publishable_ / sb_secret_ keys as not-user', async () => {
  for (const token of ['sb_publishable_abc123', 'sb_secret_def456']) {
    const identifier = await rateLimitIdentifier(
      req({ authorization: `Bearer ${token}`, 'x-forwarded-for': '6.6.6.6' }),
      stubSupabase('should-not-be-used'),
    );
    if (identifier !== 'ip:6.6.6.6') {
      throw new Error(`expected ip bucket for ${token}, got ${identifier}`);
    }
  }
});

Deno.test('rateLimitIdentifier with no auth header uses IP bucket', async () => {
  const identifier = await rateLimitIdentifier(
    req({ 'x-forwarded-for': '4.4.4.4' }),
    stubSupabase(null),
  );
  if (identifier !== 'ip:4.4.4.4') throw new Error(`expected ip bucket, got ${identifier}`);
});

Deno.test('rateLimitIdentifier hashes non-user bearer tokens (never raw)', async () => {
  const token = 'some-opaque-oauth-token-value';
  const identifier = await rateLimitIdentifier(
    req({ authorization: `Bearer ${token}` }),
    stubSupabase(null), // getUser throws → fall through to tok: hash
  );
  if (!identifier.startsWith('tok:')) throw new Error(`expected tok: bucket, got ${identifier}`);
  if (identifier.includes(token)) throw new Error('raw token leaked into identifier');
  if (identifier.length !== 'tok:'.length + 32) {
    throw new Error(`expected 32-char hash prefix, got ${identifier}`);
  }
});

Deno.test('rateLimitIdentifier is deterministic for the same non-user token', async () => {
  const a = await rateLimitIdentifier(
    req({ authorization: 'Bearer fixed-token' }),
    stubSupabase(null),
  );
  const b = await rateLimitIdentifier(
    req({ authorization: 'Bearer fixed-token' }),
    stubSupabase(null),
  );
  if (a !== b) throw new Error(`hash not deterministic: ${a} vs ${b}`);
});

Deno.test('legacy rateLimit allows then denies after maxRequests in a window', () => {
  const key = `unit-${crypto.randomUUID()}`;
  const opts = { windowMs: 60_000, maxRequests: 3 };
  const results = [
    rateLimit(key, opts),
    rateLimit(key, opts),
    rateLimit(key, opts),
    rateLimit(key, opts),
  ];
  const expected = [true, true, true, false];
  for (let i = 0; i < expected.length; i++) {
    if (results[i] !== expected[i]) {
      throw new Error(`call ${i}: expected ${expected[i]}, got ${results[i]}`);
    }
  }
});

Deno.test('getRateLimitHeaders from RateLimitResult includes limit/remaining/retry-after', () => {
  const headers = getRateLimitHeaders({
    allowed: true,
    remaining: 7,
    resetTime: Date.now() + 30_000,
    totalRequests: 3,
  });
  if (headers['X-RateLimit-Limit'] !== '10')
    throw new Error('limit should be totalRequests+remaining');
  if (headers['X-RateLimit-Remaining'] !== '7') throw new Error('remaining mismatch');
  if (!headers['Retry-After']) throw new Error('Retry-After missing');
});
