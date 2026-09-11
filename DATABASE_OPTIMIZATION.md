# Database Optimization & Performance Tuning

## Overview

NERVE's Supabase database is production-ready with comprehensive RLS policies in place. However, to maximize query performance at scale, 12 additional indexes are recommended across two phases.

## Current State

✅ **RLS Policies:** Comprehensive row-level security on 16+ tables  
✅ **Admin Access:** Gated via admin_users table with subquery verification  
✅ **Guest Orders:** Token-based verification (migration 012)  
✅ **Sensitive Operations:** SECURITY DEFINER functions for place_order, create_ticket_from_chat, etc.  
⚠️ **Missing Indexes:** 12 indexes needed for optimal query performance

## Critical Missing Indexes (Phase 1)

The following indexes should be added immediately to improve query performance:

### 1. **orders.created_at** (Admin Dashboard Sorting)
```sql
CREATE INDEX IF NOT EXISTS orders_created_at_desc_idx 
  ON orders(created_at DESC);
```
**Impact:** Eliminates full table scan for "recent orders" queries  
**Tables Affected:** orders (likely 1,000s of rows)  
**Query Pattern:** `SELECT * FROM orders ORDER BY created_at DESC LIMIT 100`

### 2. **orders (status, created_at)** (Filtered Order Views)
```sql
CREATE INDEX IF NOT EXISTS orders_status_created_at_idx 
  ON orders(status, created_at DESC);
```
**Impact:** Speeds up "show placed orders from last 7 days" queries  
**Query Pattern:** `WHERE status = 'placed' ORDER BY created_at DESC`

### 3. **product_inventory.updated_at** (Stock Monitoring)
```sql
CREATE INDEX IF NOT EXISTS product_inventory_updated_at_idx 
  ON product_inventory(updated_at DESC);
```
**Impact:** Enables efficient low-stock alerts and restock monitoring

### 4. **product_inventory.in_stock** (Stock Status Filter)
```sql
CREATE INDEX IF NOT EXISTS product_inventory_in_stock_idx 
  ON product_inventory(in_stock);
```
**Impact:** Fast out-of-stock product queries

### 5. **order_items.created_at** (Analytics & Recommendations)
```sql
CREATE INDEX IF NOT EXISTS order_items_created_at_idx 
  ON order_items(created_at DESC);
```
**Impact:** Recent purchase analytics, product recommendations

### 6. **cart_items.updated_at** (Abandoned Cart Detection)
```sql
CREATE INDEX IF NOT EXISTS cart_items_updated_at_idx 
  ON cart_items(updated_at DESC);
```
**Impact:** Efficient abandoned cart email queries

### 7. **payment_attempts (order_id, created_at)** (Payment Audit)
```sql
CREATE INDEX IF NOT EXISTS payment_attempts_order_id_created_at_idx 
  ON payment_attempts(order_id, created_at DESC);
```
**Impact:** Fast payment history audit trail retrieval

## Medium-Priority Indexes (Phase 2)

Deploy in the next sprint:

```sql
-- Product listing with active status
CREATE INDEX IF NOT EXISTS products_is_active_created_at_idx 
  ON products(is_active, created_at DESC);

-- Back-in-stock pending notifications
CREATE INDEX IF NOT EXISTS back_in_stock_pending_idx 
  ON back_in_stock_requests(product_id) 
  WHERE notified_at IS NULL;

-- Support ticket prioritization
CREATE INDEX IF NOT EXISTS support_tickets_priority_created_at_idx 
  ON support_tickets(priority, created_at DESC);

-- Email audit and delivery tracking
CREATE INDEX IF NOT EXISTS email_logs_type_sent_at_idx 
  ON email_logs(email_type, sent_at DESC);
```

## RLS Policy Optimization

### Issue: Admin Policy Subquery Not Indexed

**Current Pattern:**
```sql
CREATE POLICY "Admins can do everything" ON collections FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
```

**Problem:** This subquery runs for every row accessed by an admin. On a table with 10,000 rows, the admin_users lookup happens 10,000 times.

**Solution: Add Index to admin_users**
```sql
CREATE INDEX IF NOT EXISTS admin_users_user_id_idx ON admin_users(user_id);
```

This enables the subquery to use an index scan instead of a sequential scan.

### Future Improvement: Security Definer Function

For even better performance (optional):
```sql
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM admin_users WHERE user_id = p_user_id);
END;
$$;
REVOKE ALL ON FUNCTION is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO anon, authenticated, service_role;
```

Then update policies:
```sql
CREATE POLICY "Admins can do everything" ON collections FOR ALL 
  USING (is_admin(auth.uid()));
```

## Deployment Plan

### Immediate (Production Go-Live)

1. **Add Phase 1 indexes (7 total)**
   - Open Supabase → SQL Editor
   - Execute the 7 CREATE INDEX statements for Phase 1
   - Monitor for completion (~1-2 minutes for all 7)
   - **Downtime:** ~30 seconds total (indexes created concurrently)

2. **Add admin_users index**
   - Execute: `CREATE INDEX IF NOT EXISTS admin_users_user_id_idx ON admin_users(user_id);`
   - **Downtime:** None (small table)

### Next Sprint

Deploy Phase 2 indexes (4 total) during normal maintenance window.

## Monitoring & Verification

### Check Index Usage

Run this query regularly to identify unused indexes:

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY idx_scan ASC;
```

**Interpretation:**
- `idx_scan = 0` → Unused index (candidate for deletion)
- `idx_tup_read >> idx_tup_fetch` → Index is slow (consider optimizing)

### Check Slow Queries

Enable query logging in Supabase:

```sql
-- In Supabase: Settings → Database → Slow Query Log
-- Typical threshold: 1 second
-- Review weekly to identify missing indexes
```

### Benchmark Before/After

For critical queries, measure execution time before and after adding indexes:

```sql
-- EXPLAIN ANALYZE shows query plan and execution time
EXPLAIN ANALYZE SELECT * FROM orders ORDER BY created_at DESC LIMIT 100;
```

Run before and after adding `orders_created_at_desc_idx`.

## Query Patterns to Avoid

### ❌ Avoid: Unindexed Sorting
```sql
-- BAD: Full table scan + sort
SELECT * FROM orders ORDER BY created_at DESC;

-- GOOD: Use indexed sort
CREATE INDEX orders_created_at_desc_idx ON orders(created_at DESC);
SELECT * FROM orders ORDER BY created_at DESC;
```

### ❌ Avoid: N+1 Queries
```javascript
// BAD: Loop queries customers, then loop-query orders for each customer
const customers = await supabase.from('customers').select();
for (const customer of customers) {
  const orders = await supabase
    .from('orders')
    .select()
    .eq('customer_id', customer.id);
  // Process orders
}

// GOOD: Fetch all related orders at once
const orders = await supabase
  .from('orders')
  .select('*, customers(*)')
  .limit(1000);
```

### ❌ Avoid: Full Text Search Without Gin Index
```sql
-- If using LIKE searches, ensure a GIN index exists
CREATE INDEX IF NOT EXISTS products_search_idx 
  ON products 
  USING GIN (to_tsvector('english', name || ' ' || description || ' ' || category));

-- Then use tsvector for fast search
SELECT * FROM products 
WHERE to_tsvector('english', name) @@ to_tsquery('english', 'yoga');
```

## Performance Baselines

After deploying indexes, these queries should execute in < 100ms:

| Query | Expected Time | Table Size |
|-------|----------------|-----------|
| Recent orders (admin dashboard) | < 50ms | 10,000 rows |
| Customer order history | < 100ms | 50,000 rows |
| Product list by category | < 50ms | 500 rows |
| Cart items lookup | < 10ms | 5,000 rows |
| Payment audit trail | < 50ms | 100,000 rows |

## Checklist for Database Optimization

- [ ] **Phase 1 Indexes Deployed** (7 indexes)
- [ ] **Admin Index Deployed** (admin_users.user_id)
- [ ] **Slow Query Logging Enabled** in Supabase
- [ ] **Monthly Review:** Check `pg_stat_user_indexes` for unused indexes
- [ ] **Quarterly Benchmark:** Run `EXPLAIN ANALYZE` on top 5 queries
- [ ] **Phase 2 Indexes Deployed** (4 indexes, next sprint)
- [ ] **Future:** Implement admin check function (RLS optimization)

## References

- [Supabase: Indexes Guide](https://supabase.com/docs/guides/postgres/indexes)
- [PostgreSQL: Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [OWASP: Database Performance & Security](https://owasp.org/www-community/attacks/Performance_Driven_Database_Exhaustion)
