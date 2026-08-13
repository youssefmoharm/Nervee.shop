import { supabase } from '../lib/supabase';
import { logError } from '../lib/sentry';
import type { CartLine } from '../types';

/**
 * Cart persistence strategy:
 * - Guests: sessionStorage only (see CartContext), never touches the DB.
 * - Signed-in customers: mirrored to `carts` / `cart_items` so it survives
 *   across devices. On login, the guest's session cart is merged in once via
 *   `merge_guest_cart` (server-side, quantities summed for matching lines).
 */
export const cartService = {
  async mergeGuestCart(lines: CartLine[]) {
    try {
      if (lines.length === 0) return;
      const { error } = await supabase.rpc('merge_guest_cart', {
        p_items: lines.map(l => ({
          productId: l.productId,
          color: l.color,
          size: l.size,
          quantity: l.quantity,
        })),
      });
      if (error) throw error;
    } catch (error) {
      logError('Error merging guest cart', error);
      throw error;
    }
  },

  /** Full cart for the signed-in customer, joined with product data for display. */
  async fetchMine(): Promise<CartLine[]> {
    try {
      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .select('id')
        .maybeSingle();

      if (cartError) throw cartError;
      if (!cart) return [];

      const { data: items, error: itemsError } = await supabase
        .from('cart_items')
        .select(
          'product_id, color, size, quantity, products(name, slug, price, product_colors(name, image))',
        )
        .eq('cart_id', cart.id);

      if (itemsError) throw itemsError;
      if (!items) return [];

      return items.map((row: any) => {
        const product = row.products;
        const colorImage =
          product?.product_colors?.find((c: any) => c.name === row.color)?.image ??
          product?.product_colors?.[0]?.image ??
          '';
        return {
          productId: row.product_id,
          name: product?.name ?? '',
          slug: product?.slug ?? '',
          image: colorImage,
          price: product?.price ?? 0,
          color: row.color,
          size: row.size,
          quantity: row.quantity,
        };
      });
    } catch (error) {
      logError('Error fetching cart', error);
      return [];
    }
  },

  async upsertLine(line: CartLine) {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .upsert({ customer_id: user.id }, { onConflict: 'customer_id' })
        .select('id')
        .single();

      if (cartError) throw cartError;
      if (!cart) throw new Error('Failed to create/get cart');

      const { data: existing, error: existingError } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cart.id)
        .eq('product_id', line.productId)
        .eq('color', line.color)
        .eq('size', line.size)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + line.quantity })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('cart_items').insert({
          cart_id: cart.id,
          product_id: line.productId,
          color: line.color,
          size: line.size,
          quantity: line.quantity,
        });

        if (insertError) throw insertError;
      }
    } catch (error) {
      logError('Error upserting cart line', error);
      throw error;
    }
  },

  async removeLine(productId: string, color: string, size: string) {
    try {
      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .select('id')
        .maybeSingle();

      if (cartError) throw cartError;
      if (!cart) return;

      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id)
        .eq('product_id', productId)
        .eq('color', color)
        .eq('size', size);

      if (deleteError) throw deleteError;
    } catch (error) {
      logError('Error removing cart line', error);
      throw error;
    }
  },

  async updateQuantity(productId: string, color: string, size: string, quantity: number) {
    try {
      if (quantity < 1) {
        throw new Error('Quantity must be at least 1');
      }

      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .select('id')
        .maybeSingle();

      if (cartError) throw cartError;
      if (!cart) throw new Error('Cart not found');

      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('cart_id', cart.id)
        .eq('product_id', productId)
        .eq('color', color)
        .eq('size', size);

      if (updateError) throw updateError;
    } catch (error) {
      logError('Error updating cart quantity', error);
      throw error;
    }
  },

  async clear() {
    try {
      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .select('id')
        .maybeSingle();

      if (cartError) throw cartError;
      if (!cart) return;

      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id);

      if (deleteError) throw deleteError;
    } catch (error) {
      logError('Error clearing cart', error);
      throw error;
    }
  },
};
