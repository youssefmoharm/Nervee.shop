import { describe, it, expect } from 'vitest';
import {
  buildVirtualTryOnPayload,
  describeTryOnState,
  isMissingColumnError,
  isValidLensIdentifier,
  normalizeLensIdentifier,
  validateTryOnDraft,
  type TryOnDraft,
} from '../../lib/tryOnAdmin';

const LENS_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const GROUP_ID = 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6';

const draft = (overrides: Partial<TryOnDraft> = {}): TryOnDraft => ({
  productId: 'p-002',
  enabled: true,
  lensId: LENS_ID,
  lensGroupId: GROUP_ID,
  ...overrides,
});

describe('lens identifier handling', () => {
  it('normalises dashes, quotes and case', () => {
    expect(normalizeLensIdentifier('"A1B2C3D4-E5F6-A7B8-C9D0-E1F2A3B4C5D6"')).toBe(LENS_ID);
  });

  it('accepts canonical 32-char hex IDs', () => {
    expect(isValidLensIdentifier(LENS_ID)).toBe(true);
    expect(isValidLensIdentifier('a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6')).toBe(true);
  });

  it('rejects placeholders, wrong lengths and non-hex values', () => {
    expect(isValidLensIdentifier('')).toBe(false);
    expect(isValidLensIdentifier('YOUR_LENS_ID')).toBe(false);
    expect(isValidLensIdentifier('abc123')).toBe(false);
    expect(isValidLensIdentifier('z'.repeat(32))).toBe(false);
  });
});

describe('validateTryOnDraft', () => {
  it('passes a complete draft', () => {
    expect(validateTryOnDraft(draft())).toEqual({ ok: true, errors: [] });
  });

  it('requires both IDs when AR is enabled', () => {
    const result = validateTryOnDraft(draft({ lensId: '', lensGroupId: '' }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Lens ID is required/);
    expect(result.errors.join(' ')).toMatch(/Lens Group ID is required/);
  });

  it('gives an actionable message for malformed IDs', () => {
    const result = validateTryOnDraft(draft({ lensId: 'not-a-lens' }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/32-character hex ID/);
  });

  it('allows an empty, disabled draft (AR off)', () => {
    expect(validateTryOnDraft(draft({ enabled: false, lensId: '', lensGroupId: '' }))).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('still rejects garbage while disabled', () => {
    const result = validateTryOnDraft(draft({ enabled: false, lensId: 'nope' }));
    expect(result.ok).toBe(false);
  });
});

describe('buildVirtualTryOnPayload', () => {
  it('builds a canonical enabled config', () => {
    expect(buildVirtualTryOnPayload(draft())).toEqual({
      enabled: true,
      lensId: LENS_ID,
      lensGroupId: GROUP_ID,
    });
  });

  it('normalises pasted values', () => {
    const payload = buildVirtualTryOnPayload(
      draft({ lensId: ` ${LENS_ID.toUpperCase()} `, lensGroupId: GROUP_ID.toUpperCase() }),
    );
    expect(payload).toEqual({ enabled: true, lensId: LENS_ID, lensGroupId: GROUP_ID });
  });

  it('returns null when AR is disabled (clears the column)', () => {
    expect(buildVirtualTryOnPayload(draft({ enabled: false }))).toBeNull();
  });

  it('includes an optional label only when provided', () => {
    expect(buildVirtualTryOnPayload(draft({ label: ' Powered by Snap AR ' }))).toMatchObject({
      label: 'Powered by Snap AR',
    });
    expect(buildVirtualTryOnPayload(draft())).not.toHaveProperty('label');
  });
});

describe('describeTryOnState', () => {
  it('reports enabled only when both IDs are present', () => {
    const cfg = { enabled: true, lensId: LENS_ID, lensGroupId: GROUP_ID };
    expect(describeTryOnState(cfg)).toEqual({ enabled: true, summary: 'AR enabled' });
  });

  it('flags incomplete configs so they are not mistaken for live AR', () => {
    expect(describeTryOnState({ enabled: true, lensId: LENS_ID }).enabled).toBe(false);
    expect(describeTryOnState({ enabled: true, lensId: LENS_ID }).summary).toMatch(
      /missing Lens Group ID/,
    );
    expect(describeTryOnState({ enabled: false }).summary).toBe('Disabled');
    expect(describeTryOnState(null).summary).toBe('Not configured');
  });
});

describe('isMissingColumnError', () => {
  it('detects the pre-migration error from PostgREST', () => {
    expect(
      isMissingColumnError(
        "Could not find the 'virtual_try_on' column of 'products' in the schema cache",
      ),
    ).toBe(true);
    expect(isMissingColumnError('column "virtual_try_on" does not exist')).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isMissingColumnError('permission denied for table products')).toBe(false);
    expect(isMissingColumnError(undefined)).toBe(false);
  });
});
