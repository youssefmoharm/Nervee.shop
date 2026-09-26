export interface DashboardStats {
  // Revenue metrics
  totalRevenue: number;
  previousRevenue: number;
  grossSales: number;
  totalRefunds: number;
  totalDiscounts: number;
  netRevenue: number;

  // Order metrics
  currentOrders: number;
  previousOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;

  // Customer metrics
  newCustomers: number;
  totalCustomers: number;
  returningCustomers: number;

  // Product metrics
  totalProducts: number;
  inactiveProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;

  // Return metrics
  totalReturns: number;
  totalRefundAmount: number;
  returnRate: number;

  // Calculated metrics
  averageOrderValue: number;
  revenueGrowthPercentage: number;
  orderGrowthPercentage: number;
  customerGrowthPercentage: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  product_slug: string;
  units_sold: number;
  revenue: number;
  orders_count: number;
  return_count: number;
}

export interface DailySale {
  date: string;
  revenue: number;
  orders: number;
  units_sold: number;
}

export interface OrderSummary {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  email: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  items_count: number;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  total_sold: number;
  revenue: number;
}

export interface CustomerSummary {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  city: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface InventoryItem {
  product_id: string;
  product_name: string;
  product_slug: string;
  size: string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
}

export interface DateRange {
  label: string;
  key: DateRangeKey;
  start: Date;
  end: Date;
}

export interface DateRangeWithPrevious extends DateRange {
  previousStart: Date;
  previousEnd: Date;
}

export type DateRangeKey =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom'
  | 'all_time';
