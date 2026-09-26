import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * TEST-02 / TEST-03: shared skip policy for E2E specs.
 *
 * Local runs without secrets should still pass structurally, but CI must not
 * go green on skipped assertions when the backing credentials are supposed to
 * be configured. `skipGuard` converts a would-be skip into a hard CI failure
 * whenever the caller says the missing thing is required.
 *
 * Every call site still carries a `TEST-02` / `TEST-03:` annotation so skips
 * are greppable and auditable (see AUDIT_REPORT.md TEST-03).
 */

/** True when Supabase backend secrets are available (env or .env files). */
export function hasBackendSecrets(): boolean {
  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) return true;
  for (const file of ['.env', '.env.local']) {
    try {
      const text = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      if (/^VITE_SUPABASE_URL=.+/m.test(text) && /^VITE_SUPABASE_ANON_KEY=.+/m.test(text)) {
        return true;
      }
    } catch {
      /* file absent — treat as unconfigured */
    }
  }
  return false;
}

/**
 * Skip `condition`, but fail the test in CI when `failInCi` is true (default).
 * Outside CI this always behaves like `test.skip(condition, message)`.
 */
export function skipGuard(
  condition: boolean,
  message: string,
  { failInCi = true }: { failInCi?: boolean } = {},
): void {
  if (!condition) return;
  if (failInCi && process.env.CI) {
    throw new Error(`[TEST-02/TEST-03] skip not allowed in CI: ${message}`);
  }
  test.skip(true, message);
}
