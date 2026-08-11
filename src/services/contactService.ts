import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface ContactFormInput {
  name: string
  email: string
  subject: string
  message: string
}

export const contactService = {
  async send(input: ContactFormInput): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) {
      return { error: null }
    }
    const { error } = await supabase.from('contact_messages').insert(input)
    if (error) {
      console.error('Error sending contact message:', error)
      return { error: 'Something went wrong sending your message. Please try again or email us directly.' }
    }
    return { error: null }
  },
}
