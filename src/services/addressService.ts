import { supabase } from '../lib/supabase'

export interface Address {
  id: string
  label: string | null
  address: string
  city: string
  governorate: string
  postal_code: string | null
  is_default: boolean
}

export const addressService = {
  async list(): Promise<Address[]> {
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Error fetching addresses:', error)
      return []
    }
    return data ?? []
  },

  async create(address: Omit<Address, 'id'>) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return { error: 'You must be signed in to save an address.' }
    const { error } = await supabase.from('customer_addresses').insert({ ...address, customer_id: userId })
    return { error: error?.message ?? null }
  },

  async update(id: string, address: Partial<Omit<Address, 'id'>>) {
    const { error } = await supabase.from('customer_addresses').update(address).eq('id', id)
    return { error: error?.message ?? null }
  },

  async remove(id: string) {
    const { error } = await supabase.from('customer_addresses').delete().eq('id', id)
    return { error: error?.message ?? null }
  },

  async setDefault(id: string) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return
    await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', userId)
    await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id)
  },
}
