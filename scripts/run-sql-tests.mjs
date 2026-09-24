#!/usr/bin/env node
// Runs the pgTAP / DO-block SQL tests in supabase/tests/database/*.sql via psql.
//
// - Requires SUPABASE_DB_URL (or DATABASE_URL) to be set; otherwise skips with
//   exit 0 so CI can call this script safely without secrets.
// - Skips (exit 0) with a warning when psql is not on PATH.
// - Exits non-zero if any psql run fails (ON_ERROR_STOP=1).

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = join(root, 'supabase', 'tests', 'database');

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.log('SKIP: set SUPABASE_DB_URL to run pgTAP/DO-block SQL tests');
  process.exit(0);
}

let files;
try {
  files = readdirSync(testsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
} catch {
  console.log(`SKIP: no SQL tests directory found at ${testsDir}`);
  process.exit(0);
}

if (files.length === 0) {
  console.log('SKIP: no .sql test files in supabase/tests/database');
  process.exit(0);
}

const version = spawnSync('psql', ['--version'], { encoding: 'utf8' });
if (version.error || version.status !== 0) {
  console.warn('WARN: psql not found on PATH — skipping SQL tests');
  process.exit(0);
}

let failed = 0;
for (const file of files) {
  const path = join(testsDir, file);
  console.log(`\n=== psql -f ${file} ===`);
  const res = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', path], {
    encoding: 'utf8',
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.error) {
    console.error(`FAIL: ${file} (${res.error.message})`);
    failed += 1;
  } else if (res.status !== 0) {
    console.error(`FAIL: ${file} (exit ${res.status})`);
    failed += 1;
  } else {
    console.log(`PASS: ${file}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} SQL test file(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${files.length} SQL test file(s) passed`);
