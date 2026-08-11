import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.your_removed_credential_here

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing — running in demo mode with mock data')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)
