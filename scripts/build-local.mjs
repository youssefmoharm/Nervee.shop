import { spawnSync } from 'node:child_process';
const url = process.env.API_URL;
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || !process.env.ANON_KEY)
  throw new Error('Disposable local Supabase is required');
const result = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: process.env.ANON_KEY },
});
process.exit(result.status ?? 1);
