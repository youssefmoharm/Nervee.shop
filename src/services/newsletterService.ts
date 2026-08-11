import { supabase, isSupabaseConfigured } from '../lib/supabase'

export const newsletterService = {
  async subscribe(email: string): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) {
      // Demo mode — nothing to persist to.
      return { error: null }
    }
    const { error } = await supabase.from('newsletter_subscribers').insert({ email })
    if (error) {
      // Unique violation = already subscribed; treat as a friendly success.
      if (error.code === '23505') return { error: null }
      return { error: 'Something went wrong. Please try again.' }
    }
    return { error: null }
  },
}
