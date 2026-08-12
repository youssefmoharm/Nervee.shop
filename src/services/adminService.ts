import { supabase } from '../lib/supabase';

export const adminService = {
  async getDashboardStats() {
    const [{ count: orderCount }, { count: customerCount }, { data: orders }, { data: lowStock }] =
      await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase
          .from('orders')
          .select('total, created_at, status')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('product_inventory')
          .select('product_id, size, stock_quantity, low_stock_threshold, products(name)')
          .lte('stock_quantity', 5)
          .order('stock_quantity', { ascending: true })
          .limit(20),
      ]);

    const revenue = (orders ?? [])
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total ?? 0), 0);

    return {
      totalRevenue: revenue,
      totalOrders: orderCount ?? 0,
      totalCustomers: customerCount ?? 0,
      recentOrders: orders?.slice(0, 10) ?? [],
      lowStock: lowStock ?? [],
    };
  },

  async listOrders(status?: string) {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) console.error(error);
    return data ?? [];
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
      console.error('process-restock failed:', error);
      return;
    }
    if (data?.notified)
      console.info(
        `Notified ${data.notified} customer(s) that ${productId} (${size}) is back in stock.`,
      );
  },

  async listCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    return data ?? [];
  },

  async getCustomer(id: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*, customer_addresses(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) console.error(error);
    return data ?? null;
  },

  async listCustomerOrders(customerId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    return data ?? [];
  },

  async listProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_colors(*), product_inventory(*)')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    return data ?? [];
  },

  async createProduct(product: Record<string, unknown>) {
    const { data, error } = await supabase.from('products').insert(product).select().single();
    return { data, error: error?.message ?? null };
  },

  async updateProduct(id: string, product: Record<string, unknown>) {
    const { error } = await supabase.from('products').update(product).eq('id', id);
    return { error: error?.message ?? null };
  },

  async deleteProduct(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    return { error: error?.message ?? null };
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
    if (error) console.error(error);
    return data ?? [];
  },

  // ---- Contact messages ----
  async listContactMessages() {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
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
    if (error) console.error(error);
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
