import { spawnSync } from 'node:child_process';
if (!process.env.SUPABASE_PROJECT_REF) throw new Error('Missing SUPABASE_PROJECT_REF');
const result = spawnSync(
  'supabase',
  ['secrets', 'list', '--project-ref', process.env.SUPABASE_PROJECT_REF, '--output', 'json'],
  { encoding: 'utf8' },
);
if (result.status !== 0)
  throw new Error('Could not inspect hosted secret names. Check project access.');
const entries = JSON.parse(result.stdout);
const names = new Set(entries.map(entry => entry.name));
const missing = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'STORE_URL',
  'CRON_SECRET',
  'SENTRY_DSN',
].filter(name => !names.has(name));
if (missing.length) {
  console.error(`Configure hosted function secrets before deployment: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(
  'Required hosted function secret names are present. Values and service connectivity still require health validation.',
);
