import { isSupabaseConfigured } from '../lib/supabase';
import { getEndpoint } from '../lib/apiEndpoints';
import { logError } from '../lib/sentry';

/**
 * Newsletter subscribe via the rate-limited `contact` edge function
 * (action: newsletter). Never inserts into newsletter_subscribers with the
 * anon key — RLS allows public INSERT, so the edge is the only safe path.
 */
export const newsletterService = {
  async subscribe(email: string, honeypot?: string): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) {
      // Demo mode — nothing to persist to.
      return { error: null };
    }

    if (honeypot && honeypot.trim().length > 0) {
      return { error: null };
    }

    try {
      const res = await fetch(getEndpoint('CONTACT'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'newsletter', email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Friendly handling for already-subscribed / invalid responses
        const msg = (data as { error?: string }).error;
        if (msg && /already/i.test(msg)) return { error: null };
        return { error: msg || 'Something went wrong. Please try again.' };
      }
      return { error: null };
    } catch (err) {
      logError('Newsletter subscribe failed:', err);
      return { error: 'Something went wrong. Please try again.' };
    }
  },
};
