import { logError } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import { LOW_STOCK_DEFAULT_THRESHOLD } from '../lib/storeConfig';
import { sanitizeSearchInput } from '../lib/adminOrders';

export const adminService = {
  async listOrders(
    status?: string,
    search?: string,
    dateFrom?: string,
    dateTo?: string,
    page = 1,
    pageSize = 50,
  ) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);

    const term = search ? sanitizeSearchInput(search) : '';
    if (term) {
      // PostgREST or=(...) syntax: the term is sanitized above so user input
      // can never inject filter clauses of its own.
      query = query.or(
        `order_number.ilike.%${term}%,email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`,
      );
    }

    if (dateFrom) {
      query = query.gte('created_at', new Date(dateFrom).toISOString());
    }

    if (dateTo) {
      // Add one day to include the entire date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error, count } = await query;
    if (error) logError(error);
    return { data: data ?? [], total: count ?? 0, page, pageSize };
  },

  async updateOrderStatus(
    orderId: string,
    status: string,
    tracking?: { trackingNumber?: string; trackingUrl?: string },
    reason?: string | null,
  ) {
    const { data, error } = await supabase.functions.invoke('update-order-status', {
      body: { orderId, status, ...(tracking ?? {}), reason: reason ?? undefined },
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

  async listCustomers(page = 1, pageSize = 50, search?: string) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    const term = search ? sanitizeSearchInput(search) : '';
    if (term) {
      query = query.or(
        `email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`,
      );
    }

    const { data, error, count } = await query;
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

  async listProducts(page = 1, pageSize = 50, search?: string, active?: boolean) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('products')
      .select('*, product_colors(*), product_inventory(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    const term = search ? sanitizeSearchInput(search) : '';
    if (term) query = query.or(`name.ilike.%${term}%,category.ilike.%${term}%`);
    if (active !== undefined) query = query.eq('is_active', active);

    const { data, error, count } = await query;
    if (error) logError(error);
    return { data: data ?? [], total: count ?? 0, page, pageSize };
  },

  /**
   * Size-level low stock rows for the dashboard's restock queue: every
   * inventory row at or under its own threshold (default from storeConfig),
   * worst first. Filter happens in SQL via the max threshold scan first so
   * the candidate set stays small.
   */
  async listLowStock(limit = 10): Promise<
    {
      product_id: string;
      size: string;
      stock_quantity: number;
      low_stock_threshold: number | null;
      product: { name: string; slug: string } | null;
    }[]
  > {
    const { data: maxRow } = await supabase
      .from('product_inventory')
      .select('low_stock_threshold')
      .not('low_stock_threshold', 'is', null)
      .order('low_stock_threshold', { ascending: false })
      .limit(1)
      .maybeSingle();

    const maxThreshold =
      typeof maxRow?.low_stock_threshold === 'number'
        ? maxRow.low_stock_threshold
        : LOW_STOCK_DEFAULT_THRESHOLD;

    const { data, error } = await supabase
      .from('product_inventory')
      .select('product_id, size, stock_quantity, low_stock_threshold, products(name, slug)')
      .lte('stock_quantity', maxThreshold)
      .order('stock_quantity', { ascending: true })
      .limit(100);
    if (error) {
      logError(error);
      return [];
    }

    return (data ?? [])
      .filter(row => {
        const threshold =
          typeof row.low_stock_threshold === 'number'
            ? row.low_stock_threshold
            : LOW_STOCK_DEFAULT_THRESHOLD;
        return row.stock_quantity <= threshold;
      })
      .slice(0, limit)
      .map(row => {
        // PostgREST returns the products embed as an object for this
        // many-to-one relation, but the generated types claim an array —
        // accept either shape so display never breaks on a type drift.
        const raw = (row as { products?: unknown }).products;
        const product = Array.isArray(raw)
          ? (raw[0] as { name: string; slug: string } | undefined) ?? null
          : raw && typeof raw === 'object'
          ? (raw as { name: string; slug: string })
          : null;
        return {
          product_id: row.product_id,
          size: row.size,
          stock_quantity: row.stock_quantity,
          low_stock_threshold: row.low_stock_threshold,
          product,
        };
      });
  },

  async createProduct(product: Record<string, unknown>) {
    // Check for duplicate product name
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .ilike('name', String(product.name));

    if (countError) {
      logError('Product name uniqueness check failed', countError);
    }

    if (count && count > 0) {
      return {
        data: null,
        error: 'A product with this name already exists. Product names must be unique.',
      };
    }

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
    const { error } = await supabase.rpc('update_inventory_with_lock', {
      p_product_id: productId,
      p_size: size,
      p_new_quantity: Math.max(0, stockQuantity), // Prevent negative
    });
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
