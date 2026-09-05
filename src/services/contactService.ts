import { logError } from '../lib/sentry';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import DOMPurify from 'dompurify';

export interface ContactFormInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const contactService = {
  async send(input: ContactFormInput): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) {
      return { error: null };
    }

    // Sanitize user inputs to prevent XSS attacks
    const sanitizedInput = {
      name: DOMPurify.sanitize(input.name, { ALLOWED_TAGS: [] }),
      email: input.email,
      subject: DOMPurify.sanitize(input.subject, { ALLOWED_TAGS: [] }),
      message: DOMPurify.sanitize(input.message, { ALLOWED_TAGS: [] }),
    };

    const { error } = await supabase.from('contact_messages').insert(sanitizedInput);
    if (error) {
      logError('Error sending contact message:', error);
      return {
        error: 'Something went wrong sending your message. Please try again or email us directly.',
      };
    }
    return { error: null };
  },
};
