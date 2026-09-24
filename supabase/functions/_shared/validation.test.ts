/**
 * Deno tests for edge-function shared validation helpers (pure functions).
 * Run: deno test --allow-env supabase/functions/_shared/validation.test.ts
 */
import {
  validateEmail,
  validatePhone,
  sanitizeText,
  validateRequestSize,
  validateOrderRequest,
  validatePassword,
  validateProductId,
  validateCartItems,
  validateDiscountCode,
} from './validation.ts';

Deno.test('validateEmail accepts a normal address', () => {
  const errs = validateEmail('user@example.com');
  if (errs.length !== 0) throw new Error(`expected no errors, got ${JSON.stringify(errs)}`);
});

Deno.test('validateEmail rejects missing / malformed addresses', () => {
  if (validateEmail('').length === 0) throw new Error('empty email should fail');
  if (validateEmail('not-an-email').length === 0) throw new Error('malformed email should fail');
  if (validateEmail('@example.com').length === 0) throw new Error('missing local part should fail');
  if (validateEmail('user@').length === 0) throw new Error('missing domain should fail');
  const long = `${'a'.repeat(250)}@example.com`;
  if (validateEmail(long).length === 0) throw new Error('overlong email should fail');
});

Deno.test('validateEmail trims surrounding whitespace', () => {
  const errs = validateEmail('  user@example.com  ');
  if (errs.length !== 0) throw new Error(`trimmed email should pass, got ${JSON.stringify(errs)}`);
});

Deno.test('validatePhone accepts Egyptian local mobile 01XXXXXXXXX', () => {
  const errs = validatePhone('01012345678');
  if (errs.length !== 0) throw new Error(`expected valid, got ${JSON.stringify(errs)}`);
});

Deno.test('validatePhone normalizes +20 / 0020 / 20 prefixes', () => {
  for (const raw of ['+201012345678', '00201012345678', '201012345678']) {
    const errs = validatePhone(raw);
    if (errs.length !== 0) {
      throw new Error(`expected ${raw} to normalize to valid, got ${JSON.stringify(errs)}`);
    }
  }
});

Deno.test('validatePhone strips spaces, dashes, parens, dots before matching', () => {
  const errs = validatePhone('010-123-456 78');
  if (errs.length !== 0)
    throw new Error(`expected formatted phone valid, got ${JSON.stringify(errs)}`);
});

Deno.test('validatePhone rejects non-Egyptian / short / long numbers', () => {
  for (const bad of ['12345', '+14155552671', '0101234567', '010123456789', '']) {
    if (validatePhone(bad).length === 0) throw new Error(`expected ${bad} to fail`);
  }
});

Deno.test('sanitizeText strips angle brackets and javascript: URLs', () => {
  const out = sanitizeText('<script>alert(1)</script> visit javascript:alert(1)');
  if (out.includes('<') || out.includes('>')) throw new Error(`angle brackets remain: ${out}`);
  if (/javascript:/i.test(out)) throw new Error(`javascript: remains: ${out}`);
});

Deno.test('sanitizeText removes inline event handlers and trims', () => {
  const out = sanitizeText('  hello onclick=steal() onload=x  ');
  if (/on\w+\s*=/i.test(out)) throw new Error(`event handler remains: ${out}`);
  if (out !== out.trim()) throw new Error(`not trimmed: ${JSON.stringify(out)}`);
});

Deno.test('sanitizeText enforces max length and non-string safety', () => {
  const out = sanitizeText('x'.repeat(50), 10);
  if (out.length !== 10) throw new Error(`expected 10 chars, got ${out.length}`);
  if (sanitizeText(null as unknown as string) !== '')
    throw new Error('null should map to empty string');
  if (sanitizeText(123 as unknown as string) !== '')
    throw new Error('non-string should map to empty string');
});

Deno.test('validateRequestSize passes small payloads and flags oversized content-length', () => {
  const small = new Request('https://example.test/', {
    method: 'POST',
    headers: { 'content-length': '1024' },
  });
  if (validateRequestSize(small, 100).length !== 0) throw new Error('1KB should pass 100KB limit');

  const big = new Request('https://example.test/', {
    method: 'POST',
    headers: { 'content-length': String(200 * 1024) },
  });
  if (validateRequestSize(big, 100).length === 0) throw new Error('200KB should fail 100KB limit');
});

Deno.test('validateRequestSize ignores requests with no content-length', () => {
  const req = new Request('https://example.test/', { method: 'POST' });
  if (validateRequestSize(req, 100).length !== 0)
    throw new Error('missing content-length should pass');
});

function validOrderBody() {
  return {
    email: 'buyer@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    phone: '01012345678',
    address: '15 Street Name, Apt 4, Maadi',
    city: 'Cairo',
    governorate: 'Cairo',
    deliveryMethod: 'standard',
    paymentMethod: 'cod',
    items: [{ productId: 'p-001', color: 'Navy', size: 'M', quantity: 1 }],
  };
}

Deno.test('validateOrderRequest passes a fully valid COD order', () => {
  const errs = validateOrderRequest(validOrderBody());
  if (errs.length !== 0) throw new Error(`expected no errors, got ${JSON.stringify(errs)}`);
});

Deno.test('validateOrderRequest rejects null body and non-object', () => {
  if (validateOrderRequest(null).length === 0) throw new Error('null body should fail');
  if (validateOrderRequest('nope').length === 0) throw new Error('string body should fail');
});

Deno.test('validateOrderRequest surfaces field-level failures', () => {
  const body = {
    ...validOrderBody(),
    email: 'bad',
    phone: '555',
    deliveryMethod: 'drone',
    paymentMethod: 'crypto',
    items: [],
  };
  const errs = validateOrderRequest(body);
  const fields = new Set(errs.map(e => e.field));
  for (const f of ['email', 'phone', 'deliveryMethod', 'paymentMethod', 'items']) {
    if (!fields.has(f)) throw new Error(`expected error for ${f}, got ${[...fields].join(',')}`);
  }
});

Deno.test('validatePassword enforces strength rules', () => {
  if (validatePassword('short1!').length === 0) throw new Error('short password should fail');
  const good = validatePassword('Str0ngPass!');
  if (good.length !== 0)
    throw new Error(`strong password should pass, got ${JSON.stringify(good)}`);
});

Deno.test('validateProductId accepts slug-like ids and rejects bad chars', () => {
  if (validateProductId('p-001').length !== 0) throw new Error('p-001 should pass');
  if (validateProductId('has space').length === 0) throw new Error('space should fail');
  if (validateProductId('').length === 0) throw new Error('empty should fail');
});

Deno.test('validateCartItems validates every line and count bounds', () => {
  if (validateCartItems([]).length === 0) throw new Error('empty cart should fail');
  if (validateCartItems('nope').length === 0) throw new Error('non-array should fail');
  const ok = validateCartItems([{ productId: 'p-001', color: 'Navy', size: 'M', quantity: 2 }]);
  if (ok.length !== 0) throw new Error(`valid cart should pass, got ${JSON.stringify(ok)}`);
  const badQty = validateCartItems([
    { productId: 'p-001', color: 'Navy', size: 'M', quantity: 99 },
  ]);
  if (!badQty.some(e => e.field.includes('quantity'))) {
    throw new Error('oversized quantity should fail');
  }
});

Deno.test('validateDiscountCode is optional but format-checked when present', () => {
  if (validateDiscountCode('').length !== 0) throw new Error('empty is optional');
  if (validateDiscountCode(undefined as unknown as string).length !== 0) {
    throw new Error('undefined is optional');
  }
  if (validateDiscountCode('NERVE10').length !== 0) throw new Error('alphanumeric should pass');
  if (validateDiscountCode('bad code!').length === 0) throw new Error('special chars should fail');
  if (validateDiscountCode('A'.repeat(30)).length === 0) throw new Error('overlong should fail');
});
