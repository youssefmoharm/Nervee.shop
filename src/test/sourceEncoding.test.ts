import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * UX-01 regression guard: Header.tsx once shipped double-encoded Arabic
 * ('Ø§Ù„...' instead of 'التبديل إلى العربية'), which rendered as garbage in
 * the language switcher. Any Latin-1-encoded UTF-8 round-trips back to Arabic
 * only when the file contains mojibake, so this catches it in CI.
 */

const ARABIC = /[\u0600-\u06FF]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('source encoding (UX-01)', () => {
  it('contains no double-encoded Arabic (mojibake) in src', () => {
    const offenders: string[] = [];

    for (const file of walk(join(process.cwd(), 'src'))) {
      const content = readFileSync(file, 'utf8');
      if (ARABIC.test(content)) continue; // correctly encoded Arabic is fine
      const roundTrip = Buffer.from(content, 'latin1').toString('utf8');
      if (ARABIC.test(roundTrip)) offenders.push(file.replace(process.cwd() + '\\', ''));
    }

    expect(offenders).toEqual([]);
  });
});
