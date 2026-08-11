import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { CartLine } from '../types'

export interface CheckoutInfo {
  email: string
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  governorate: string
  postalCode?: string
  deliveryMethod: 'standard' | 'express'
  paymentMethod: 'cod' | 'card'
  discountCode?: string
}

export interface PlaceOrderResult {
  order: {
    id: string
    order_number: string
    subtotal: number
    shipping_cost: number
    discount_amount: number
    total: number
  } | null
  paymentUrl: string | null
  error: string | null
}

export const orderService = {
  /**
   * Places an order. This calls the `create-order` Supabase Edge Function,
   * which re-validates stock and re-prices every line server-side — nothing
   * about totals or availability is trusted from the client.
   */
  async placeOrder(info: CheckoutInfo, lines: CartLine[]): Promise<PlaceOrderResult> {
    if (!isSupabaseConfigured) {
      return {
        order: null,
        paymentUrl: null,
        error:
          'Checkout requires Supabase to be configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). This demo instance is running on mock data.',
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          ...info,
          items: lines.map((l) => ({
            productId: l.productId,
            color: l.color,
            size: l.size,
            quantity: l.quantity,
            image: l.image,
          })),
        },
      })

      if (error) {
        // Edge function returned a non-2xx; the error message from our
        // handler is usually in error.context, fall back to a generic one.
        const message =
          (typeof data === 'object' && data && 'error' in data && (data as any).error) ||
          error.message ||
          'Could not place your order. Please try again.'
        return { order: null, paymentUrl: null, error: message }
      }

      if (data?.error) {
        return { order: null, paymentUrl: null, error: data.error }
      }

      return { order: data.order, paymentUrl: data.paymentUrl ?? null, error: null }
    } catch (err) {
      console.error('placeOrder failed:', err)
      return { order: null, paymentUrl: null, error: 'Network error. Please check your connection and try again.' }
    }
  },

  /** Order history for the currently signed-in customer */
  async listMine() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Error fetching orders:', error)
      return []
    }
    return data ?? []
  },

  async getById(id: string) {
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).single()
    if (error || !order) return null
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', id)
    return { ...order, items: items ?? [] }
  },
}
