// Exercises a database backup/restore only inside a disposable loopback cluster.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, openSync, closeSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const source = process.env.SUPABASE_DB_URL;
if (!source || !['localhost', '127.0.0.1'].includes(new URL(source).hostname))
  throw new Error('A disposable local database URL is required');
const name = `restore_${randomUUID().replaceAll('-', '')}`;
const target = new URL(source);
target.pathname = `/${name}`;
const directory = mkdtempSync(join(tmpdir(), 'nerve-restore-'));
const archive = join(directory, 'backup.dump');
let created = false;
function run(command, args, stdio = 'pipe') {
  const result = spawnSync(command, args, {
    stdio,
    encoding: stdio === 'pipe' ? 'utf8' : undefined,
  });
  if (result.error || result.status !== 0)
    throw new Error(`${command} failed${result.stderr ? ': ' + result.stderr : ''}`);
  return result.stdout?.trim();
}
const counts =
  "SELECT (SELECT count(*) FROM auth.users)||','||(SELECT count(*) FROM orders)||','||(SELECT count(*) FROM products)||','||(SELECT count(*) FROM order_items)||','||(SELECT count(*) FROM cod_refund_obligations)";
try {
  const before = run('psql', [
    '--dbname',
    source,
    '-X',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    counts,
  ]);
  const output = openSync(archive, 'wx', 0o600);
  try {
    run('pg_dump', ['--dbname', source, '--format=custom'], ['ignore', output, 'inherit']);
  } finally {
    closeSync(output);
  }
  run('psql', [
    '--dbname',
    source,
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `CREATE DATABASE "${name}"`,
  ]);
  created = true;
  const input = openSync(archive, 'r');
  try {
    run('pg_restore', ['--dbname', target.href, '--exit-on-error'], [input, 'ignore', 'inherit']);
  } finally {
    closeSync(input);
  }
  const after = run('psql', [
    '--dbname',
    target.href,
    '-X',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    counts,
  ]);
  if (before !== after) throw new Error('Restored record counts differ');
  const tests = spawnSync('node', ['scripts/run-sql-tests.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_DB_URL: target.href, REQUIRE_SQL_TESTS: '1' },
  });
  if (tests.status !== 0) throw new Error('Restored database failed integrity tests');
  console.log(
    'PASS: private backup restored into separate database; counts and database assertions verified',
  );
} finally {
  if (created)
    run('psql', [
      '--dbname',
      source,
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `DROP DATABASE "${name}" WITH (FORCE)`,
    ]);
  rmSync(directory, { recursive: true, force: true });
}
