import { createClient } from '@supabase/supabase-js';

// Required production env vars — must be set as Vercel/host build-time env.
// The anon/publishable key is public by design (sent to the browser
// regardless); the database itself is protected by row-level security.
const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isProdBuild = import.meta.env.PROD;

if (!envUrl || !envKey) {
  if (isProdBuild) {
    throw new Error(
      '[supabase] Missing required build-time env: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. ' +
        'Set them in your hosting provider (e.g. Vercel → Settings → Environment Variables) and rebuild. ' +
        'Refusing to silently fall back to mock/demo data in production.',
    );
  }
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — running in demo/mock mode (development only).',
  );
}

// In production these are guaranteed present (otherwise we threw above).
// In development, use placeholders so the Supabase client can be created
// without crashing; services gate on isSupabaseConfigured.
export const SUPABASE_URL = envUrl ?? 'https://placeholder.supabase.co';
export const SUPABASE_ANON_KEY = envKey ?? 'placeholder-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// True only when real env vars were supplied — services use this to decide
// between live backend vs. mock/demo data. Never true via fallback.
export const isSupabaseConfigured = !!(envUrl && envKey);
