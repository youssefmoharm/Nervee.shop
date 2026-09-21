/**
 * Admin-side helpers for managing Virtual Try-On lens configuration.
 *
 * Kept separate from tryOnConfig.ts (which resolves config at runtime for the
 * storefront) because the admin needs *strict* validation: a typo here would
 * silently disable AR for a live product, so invalid input is rejected with a
 * precise message instead of being normalised away.
 */

import type { VirtualTryOnConfig } from '../types/virtualTryOn';

export interface TryOnDraft {
  /** Product row id (used for the update). */
  productId: string;
  enabled: boolean;
  lensId: string;
  lensGroupId: string;
  label?: string;
}

export interface TryOnValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Snap Lens IDs and Lens Group IDs are 32-character hex UUIDs (no dashes).
 * We accept the dashed/lower-case/upper-case forms people paste from the
 * portal and normalise to the canonical lower-case, dash-free form.
 */
export function normalizeLensIdentifier(raw: string): string {
  return (raw ?? '')
    .trim()
    .replace(/["'<>]/g, '')
    .replace(/-/g, '')
    .toLowerCase();
}

export function isValidLensIdentifier(value: string): boolean {
  return /^[0-9a-f]{32}$/.test(normalizeLensIdentifier(value));
}

/** Validate a draft row before writing it to the database. */
export function validateTryOnDraft(draft: TryOnDraft): TryOnValidationResult {
  const errors: string[] = [];

  if (!draft.productId) errors.push('Missing product id.');

  if (draft.enabled) {
    if (!draft.lensId.trim()) {
      errors.push('Lens ID is required when AR is enabled.');
    } else if (!isValidLensIdentifier(draft.lensId)) {
      errors.push(
        'Lens ID must be a 32-character hex ID (copy it from the Lens Scheduler, e.g. a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6).',
      );
    }

    if (!draft.lensGroupId.trim()) {
      errors.push('Lens Group ID is required when AR is enabled.');
    } else if (!isValidLensIdentifier(draft.lensGroupId)) {
      errors.push(
        'Lens Group ID must be a 32-character hex ID (shown next to the lens in the Lens Scheduler).',
      );
    }
  } else if (draft.lensId.trim() && !isValidLensIdentifier(draft.lensId)) {
    // Even while disabled, don't persist obvious garbage.
    errors.push('Lens ID must be a 32-character hex ID.');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Build the `products.virtual_try_on` jsonb payload.
 * Returns `null` when AR is disabled — matching the column contract where
 * NULL means "this product has no try-on" (see migration 024).
 */
export function buildVirtualTryOnPayload(draft: TryOnDraft): VirtualTryOnConfig | null {
  if (!draft.enabled) return null;

  const config: VirtualTryOnConfig = {
    enabled: true,
    lensId: normalizeLensIdentifier(draft.lensId),
  };

  const groupId = normalizeLensIdentifier(draft.lensGroupId);
  if (groupId) config.lensGroupId = groupId;

  const label = (draft.label ?? '').trim();
  if (label) config.label = label;

  return config;
}

/** Human summary of a product's current AR state, for the admin table. */
export function describeTryOnState(raw: unknown): { enabled: boolean; summary: string } {
  if (!raw || typeof raw !== 'object') return { enabled: false, summary: 'Not configured' };

  const cfg = raw as Partial<VirtualTryOnConfig>;
  if (cfg.enabled !== true) return { enabled: false, summary: 'Disabled' };
  if (typeof cfg.lensId !== 'string' || !cfg.lensId.trim()) {
    return { enabled: false, summary: 'Enabled but missing Lens ID' };
  }
  if (typeof cfg.lensGroupId !== 'string' || !cfg.lensGroupId.trim()) {
    return { enabled: false, summary: 'Enabled but missing Lens Group ID' };
  }
  return { enabled: true, summary: 'AR enabled' };
}

/**
 * The `virtual_try_on` column ships in migration 024. If an operator hasn't
 * run it yet, Postgres answers with a "column ... does not exist" style error
 * (surfaced by PostgREST as a schema-cache message). Detect it so the admin UI
 * can tell them exactly what to do instead of showing a raw error.
 */
export function isMissingColumnError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /virtual_try_on|column .* does not exist|could not find the .* column|schema cache/i.test(
    message,
  );
}
