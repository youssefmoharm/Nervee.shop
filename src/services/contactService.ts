import { logError } from '../lib/sentry';
import { isSupabaseConfigured } from '../lib/supabase';
import { getEndpoint } from '../lib/apiEndpoints';

export interface ContactFormInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Sends contact messages through the `contact` edge function (rate-limited,
 * validated, service-role insert) — never via a raw anon-key table insert.
 * Includes a honeypot field the edge ignores; humans never fill it.
 */
export const contactService = {
  async send(input: ContactFormInput & { website?: string }): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) {
      return { error: null };
    }

    // Honeypot: bots fill every visible field. If filled, pretend success.
    if (input.website && input.website.trim().length > 0) {
      return { error: null };
    }

    try {
      const res = await fetch(getEndpoint('CONTACT'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'contact',
          name: input.name,
          email: input.email,
          subject: input.subject,
          message: input.message,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        logError('Contact edge function error:', data);
        return {
          error:
            (data as { error?: string }).error ||
            'Something went wrong sending your message. Please try again or email us directly.',
        };
      }
      return { error: null };
    } catch (err) {
      logError('Contact request failed:', err);
      return {
        error: 'Something went wrong sending your message. Please try again or email us directly.',
      };
    }
  },
};
