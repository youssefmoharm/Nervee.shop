import { logError } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import type { WishlistItem } from '../types';

export const wishlistService = {
  async fetchMine(): Promise<WishlistItem[]> {
    const { data: wishlist } = await supabase.from('wishlists').select('id').maybeSingle();
    if (!wishlist) return [];

    const { data: items, error } = await supabase
      .from('wishlist_items')
      .select('product_id, products(name, slug, price, product_colors(image))')
      .eq('wishlist_id', wishlist.id);

    if (error || !items) {
      logError('Error fetching wishlist:', error);
      return [];
    }

    return items.map((row: any) => ({
      productId: row.product_id,
      name: row.products?.name ?? '',
      slug: row.products?.slug ?? '',
      image: row.products?.product_colors?.[0]?.image ?? '',
      price: row.products?.price ?? 0,
    }));
  },

  async add(productId: string) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    const { data: wishlist } = await supabase
      .from('wishlists')
      .upsert({ customer_id: userId }, { onConflict: 'customer_id' })
      .select('id')
      .single();
    if (!wishlist) return;
    await supabase
      .from('wishlist_items')
      .upsert(
        { wishlist_id: wishlist.id, product_id: productId },
        { onConflict: 'wishlist_id,product_id' },
      );
  },

  async remove(productId: string) {
    const { data: wishlist } = await supabase.from('wishlists').select('id').maybeSingle();
    if (!wishlist) return;
    await supabase
      .from('wishlist_items')
      .delete()
      .eq('wishlist_id', wishlist.id)
      .eq('product_id', productId);
  },

  async mergeGuestWishlist(items: WishlistItem[]) {
    for (const item of items) {
      await this.add(item.productId);
    }
  },
};
