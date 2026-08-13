import { logError } from '../lib/sentry';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const backInStockService = {
  async request(productId: string, size: string, email: string): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) return { error: null };

    const { error } = await supabase
      .from('back_in_stock_requests')
      .insert({ product_id: productId, size, email });
    if (error) {
      // Unique violation = they already asked for this exact product/size — treat as success.
      if (error.code === '23505') return { error: null };
      logError('Error creating back-in-stock request:', error);
      return { error: 'Something went wrong. Please try again.' };
    }
    return { error: null };
  },
};
