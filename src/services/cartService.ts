import { supabase } from '../lib/supabase'
import type { CartLine } from '../types'

/**
 * Cart persistence strategy:
 * - Guests: sessionStorage only (see CartContext), never touches the DB.
 * - Signed-in customers: mirrored to `carts` / `cart_items` so it survives
 *   across devices. On login, the guest's session cart is merged in once via
 *   `merge_guest_cart` (server-side, quantities summed for matching lines).
 */
export const cartService = {
  async mergeGuestCart(lines: CartLine[]) {
    if (lines.length === 0) return
    const { error } = await supabase.rpc('merge_guest_cart', {
      p_items: lines.map((l) => ({
        productId: l.productId,
        color: l.color,
        size: l.size,
        quantity: l.quantity,
      })),
    })
    if (error) console.error('Error merging guest cart:', error)
  },

  /** Full cart for the signed-in customer, joined with product data for display. */
  async fetchMine(): Promise<CartLine[]> {
    const { data: cart } = await supabase.from('carts').select('id').maybeSingle()
    if (!cart) return []

    const { data: items, error } = await supabase
      .from('cart_items')
      .select('product_id, color, size, quantity, products(name, slug, price, product_colors(name, image))')
      .eq('cart_id', cart.id)

    if (error || !items) {
      console.error('Error fetching cart:', error)
      return []
    }

    return items.map((row: any) => {
      const product = row.products
      const colorImage =
        product?.product_colors?.find((c: any) => c.name === row.color)?.image ?? product?.product_colors?.[0]?.image ?? ''
      return {
        productId: row.product_id,
        name: product?.name ?? '',
        slug: product?.slug ?? '',
        image: colorImage,
        price: product?.price ?? 0,
        color: row.color,
        size: row.size,
        quantity: row.quantity,
      }
    })
  },

  async upsertLine(line: CartLine) {
    const { data: cart } = await supabase
      .from('carts')
      .upsert({ customer_id: (await supabase.auth.getUser()).data.user?.id }, { onConflict: 'customer_id' })
      .select('id')
      .single()
    if (!cart) return

    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id)
      .eq('product_id', line.productId)
      .eq('color', line.color)
      .eq('size', line.size)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + line.quantity })
        .eq('id', existing.id)
    } else {
      await supabase.from('cart_items').insert({
        cart_id: cart.id,
        product_id: line.productId,
        color: line.color,
        size: line.size,
        quantity: line.quantity,
      })
    }
  },

  async removeLine(productId: string, color: string, size: string) {
    const { data: cart } = await supabase.from('carts').select('id').maybeSingle()
    if (!cart) return
    await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id)
      .eq('product_id', productId)
      .eq('color', color)
      .eq('size', size)
  },

  async updateQuantity(productId: string, color: string, size: string, quantity: number) {
    const { data: cart } = await supabase.from('carts').select('id').maybeSingle()
    if (!cart) return
    await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('cart_id', cart.id)
      .eq('product_id', productId)
      .eq('color', color)
      .eq('size', size)
  },

  async clear() {
    const { data: cart } = await supabase.from('carts').select('id').maybeSingle()
    if (!cart) return
    await supabase.from('cart_items').delete().eq('cart_id', cart.id)
  },
}
