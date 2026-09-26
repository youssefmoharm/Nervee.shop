import { logError } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import { LOW_STOCK_DEFAULT_THRESHOLD } from '../lib/storeConfig';

export const adminService = {
  async getDashboardStats() {
    const [{ count: orderCount }, { count: customerCount }, { data: orders }] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase
        .from('orders')
        .select('total, created_at, status')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    // Two-step low stock query: find the highest threshold first, then fetch candidates.
    const { data: maxThresholdRow } = await supabase
      .from('product_inventory')
      .select('low_stock_threshold')
      .not('low_stock_threshold', 'is', null)
      .order('low_stock_threshold', { ascending: false })
      .limit(1)
      .maybeSingle();

    const maxThreshold =
      typeof maxThresholdRow?.low_stock_threshold === 'number'
        ? maxThresholdRow.low_stock_threshold
        : LOW_STOCK_DEFAULT_THRESHOLD;

    const { data: lowStockCandidates } = await supabase
      .from('product_inventory')
      .select('product_id, size, stock_quantity, low_stock_threshold, products(name)')
      .lte('stock_quantity', maxThreshold)
      .order('stock_quantity', { ascending: true });

    const lowStock = (lowStockCandidates ?? [])
      .filter(row => {
        const threshold =
          typeof row.low_stock_threshold === 'number'
            ? row.low_stock_threshold
            : LOW_STOCK_DEFAULT_THRESHOLD;
        return row.stock_quantity <= threshold;
      })
      .slice(0, 20);

    const revenue = (orders ?? [])
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total ?? 0), 0);

    // Calculate monthly revenue (last 12 months)
    const monthlyRevenue = await supabase
      .from('orders')
      .select('total, created_at')
      .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    const monthlyStats: { month: string; revenue: number }[] = [];
    if (monthlyRevenue.data) {
      const monthlyMap = new Map<string, number>();
      monthlyRevenue.data.forEach(o => {
        const month = new Date(o.created_at).toLocaleString('default', { month: 'short' });
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + (o.total || 0));
      });
      monthlyMap.forEach((rev, month) => monthlyStats.push({ month, revenue: rev }));
    }

    // Calculate daily order count (last 30 days)
    const dailyOrders = await supabase
      .from('orders')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    const dailyStats: { day: string; count: number }[] = [];
    if (dailyOrders.data) {
      const dailyMap = new Map<string, number>();
      dailyOrders.data.forEach(o => {
        const day = new Date(o.created_at).toLocaleString('default', { weekday: 'short' });
        dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      });
      dailyMap.forEach((count, day) => dailyStats.push({ day, count }));
    }

    return {
      totalRevenue: revenue,
      totalOrders: orderCount ?? 0,
      totalCustomers: customerCount ?? 0,
      totalProducts: 0, // Can be fetched separately if needed
      totalCartAbandonments: 0, // Can be fetched from cart_abandonment_tracking table
      recentOrders: orders?.slice(0, 10) ?? [],
      lowStock,
      monthlyRevenue: monthlyStats,
      dailyOrders: dailyStats,
    };
  },

  async listOrders(status?: string, page = 1, pageSize = 50) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) logError(error);
    return { data: data ?? [], total: count ?? 0, page, pageSize };
  },

  async updateOrderStatus(
    orderId: string,
    status: string,
    tracking?: { trackingNumber?: string; trackingUrl?: string },
  ) {
    const { data, error } = await supabase.functions.invoke('update-order-status', {
      body: { orderId, status, ...tracking },
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    return { error: null };
  },

  // Verify payment is not applicable for Cash on Delivery orders
  async triggerRestockCheck(productId: string, size: string) {
    const { data, error } = await supabase.functions.invoke('process-restock', {
      body: { productId, size },
    });
    if (error) {
      logError('process-restock failed:', error);
      return;
    }
    if (data?.notified && import.meta.env.DEV)
      console.info(
        `Notified ${data.notified} customer(s) that ${productId} (${size}) is back in stock.`,
      );
  },

  async listCustomers(page = 1, pageSize = 50) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) logError(error);
    return { data: data ?? [], total: count ?? 0, page, pageSize };
  },

  async getCustomer(id: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*, customer_addresses(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) logError(error);
    return data ?? null;
  },

  async listCustomerOrders(customerId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) logError(error);
    return data ?? [];
  },

  async listProducts(page = 1, pageSize = 50) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from('products')
      .select('*, product_colors(*), product_inventory(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) logError(error);
    return { data: data ?? [], total: count ?? 0, page, pageSize };
  },

  async createProduct(product: Record<string, unknown>) {
    const { data, error } = await supabase.from('products').insert(product).select().single();
    return { data, error: error?.message ?? null };
  },

  async updateProduct(id: string, product: Record<string, unknown>) {
    const { error } = await supabase.from('products').update(product).eq('id', id);
    return { error: error?.message ?? null };
  },

  /**
   * FLOW-07: products referenced by order history are soft-deleted
   * (is_active=false) so past orders keep their product row — a hard delete
   * would hit order_items ON DELETE SET NULL and cascade away reviews.
   * Products with no order history are hard-deleted as before. If the history
   * check itself fails, defaults to the non-destructive soft delete.
   */
  async deleteProduct(id: string): Promise<{ error: string | null; hidden: boolean }> {
    const { data: used, error: usageError } = await supabase
      .from('order_items')
      .select('id')
      .eq('product_id', id)
      .limit(1);
    if (usageError) {
      logError('Order history check failed, soft-deleting product', usageError);
    }
    if (usageError || (used && used.length > 0)) {
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
      return { error: error?.message ?? null, hidden: !error };
    }
    const { error } = await supabase.from('products').delete().eq('id', id);
    return { error: error?.message ?? null, hidden: false };
  },

  async setInventory(productId: string, size: string, stockQuantity: number) {
    const { error } = await supabase
      .from('product_inventory')
      .update({ stock_quantity: stockQuantity, in_stock: stockQuantity > 0 })
      .eq('product_id', productId)
      .eq('size', size);
    return { error: error?.message ?? null };
  },

  // ---- Discount codes ----

  async listDiscounts() {
    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) logError(error);
    return data ?? [];
  },

  // ---- Contact messages ----
  async listContactMessages() {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) logError(error);
    return data ?? [];
  },

  async updateContactMessageStatus(id: string, status: string) {
    const { error } = await supabase.from('contact_messages').update({ status }).eq('id', id);
    return { error: error?.message ?? null };
  },

  // ---- Newsletter ----
  async listNewsletterSubscribers() {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) logError(error);
    return data ?? [];
  },

  async createDiscount(discount: Record<string, unknown>) {
    const { error } = await supabase
      .from('discount_codes')
      .insert({ ...discount, code: String(discount.code).toUpperCase() });
    return { error: error?.message ?? null };
  },

  async updateDiscount(id: string, discount: Record<string, unknown>) {
    const patch = { ...discount };
    if (typeof patch.code === 'string') patch.code = patch.code.toUpperCase();
    const { error } = await supabase.from('discount_codes').update(patch).eq('id', id);
    return { error: error?.message ?? null };
  },

  async deleteDiscount(id: string) {
    const { error } = await supabase.from('discount_codes').delete().eq('id', id);
    return { error: error?.message ?? null };
  },
};
