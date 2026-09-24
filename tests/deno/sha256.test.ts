/**
 * Mirrors the private sha256 helper in
 * supabase/functions/create-order/index.ts (lines ~313-317):
 *
 *   async function sha256(text: string): Promise<{ hashBuffer: ArrayBuffer }> {
 *     const data = new TextEncoder().encode(text)
 *     const hashBuffer = await crypto.subtle.digest('SHA-256', data)
 *     return { hashBuffer }
 *   }
 *
 * create-order hashes guest verification tokens to hex before storing
 * token_hash. The helper is not exported from the edge function (and we do
 * not extract production source just for tests), so this suite reimplements
 * the exact same algorithm and asserts determinism + known digests so any
 * drift in the hashing approach is caught at review time.
 *
 * Run: deno test tests/deno/sha256.test.ts
 */

async function sha256(text: string): Promise<{ hashBuffer: ArrayBuffer }> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return { hashBuffer };
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.test('sha256 hex helper matches known SHA-256 vectors (mirrors create-order)', async () => {
  const { hashBuffer } = await sha256('');
  const hex = toHex(hashBuffer);
  const expected = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  if (hex !== expected) throw new Error(`empty string digest mismatch: ${hex}`);

  const { hashBuffer: h2 } = await sha256('abc');
  const hex2 = toHex(h2);
  const expected2 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  if (hex2 !== expected2) throw new Error(`'abc' digest mismatch: ${hex2}`);
});

Deno.test('token hashing is deterministic for the same input', async () => {
  const token = 'a'.repeat(64); // create-order uses two UUIDs stripped of dashes (64 hex chars)
  const first = toHex((await sha256(token)).hashBuffer);
  const second = toHex((await sha256(token)).hashBuffer);
  if (first !== second) throw new Error(`digest not deterministic: ${first} vs ${second}`);
  if (first.length !== 64) throw new Error(`expected 64 hex chars, got ${first.length}`);
});

Deno.test(
  'different tokens produce different hashes (no collision on realistic input)',
  async () => {
    const t1 = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const t2 = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const h1 = toHex((await sha256(t1)).hashBuffer);
    const h2 = toHex((await sha256(t2)).hashBuffer);
    if (h1 === h2) throw new Error('distinct tokens hashed identically');
  },
);

Deno.test(
  'hex encoding is lowercase zero-padded (matches create-order token_hash format)',
  async () => {
    // A message whose digest contains a byte < 0x10 exercises padStart(2,'0').
    const hex = toHex((await sha256('NERVE')).hashBuffer);
    if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`unexpected hex format: ${hex}`);
  },
);
