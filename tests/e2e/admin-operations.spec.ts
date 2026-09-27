import { test, expect, type Page, type Request } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Admin dashboard operations — fully mocked (no live backend, no secrets).
 *
 * A fake Supabase session is injected straight into localStorage under the
 * same storage key supabase-js uses, and every `rest/v1` / `functions/v1`
 * call is intercepted with page.route, so these tests run everywhere:
 *
 *   1. admin access: signed-in admin sees the dashboard with real KPI data
 *   2. unauthorized access: signed-in non-admin gets Access Denied
 *   3. order status transitions: invalid options disabled, valid change
 *      posts the expected edge-function payload
 *   4. server-side search: list searches hit PostgREST (not client filter)
 *   5. product form validation: price/compare-at rejected before any write
 *   6. responsive: 375px layout with a working hamburger drawer
 */

const USER_ID = '11111111-1111-4111-8111-111111111111';

function supabaseUrl(): string | null {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
  try {
    const env = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    const match = env.match(/^VITE_SUPABASE_URL=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    /* no .env — structural skip below */
  }
  return null;
}

const SUPABASE_URL = supabaseUrl();
const STORAGE_KEY = SUPABASE_URL
  ? `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
  : null;

function base64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fakeSession(): string {
  const jwt = [
    base64Url({ alg: 'HS256', typ: 'JWT' }),
    base64Url({
      sub: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      exp: 4102444800, // 2100-01-01 — never triggers a refresh round-trip
      iat: 1758960000,
      session_id: 'e2e-fake',
    }),
    'e2e-signature',
  ].join('.');

  return JSON.stringify({
    access_token: jwt,
    refresh_token: 'e2e-fake-refresh-token',
    expires_at: 4102444800,
    expires_in: 31536000,
    token_type: 'bearer',
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e-admin@nerve.test',
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      is_super_admin: null,
    },
  });
}

const ORDER = {
  id: '22222222-2222-4222-8222-222222222222',
  order_number: 'NV-1001',
  email: 'buyer@example.com',
  first_name: 'Sara',
  last_name: 'Nagy',
  total: 1299,
  status: 'placed',
  payment_status: 'pending',
  payment_provider: null,
  created_at: '2026-09-20T10:00:00.000Z',
};

const DASHBOARD_ROW = {
  current_revenue: 12000,
  previous_revenue: 10000,
  gross_sales: 9000,
  total_refunds: 500,
  total_discounts: 300,
  current_orders: 12,
  previous_orders: 10,
  pending_orders: 3,
  completed_orders: 6,
  cancelled_orders: 1,
  new_customers: 4,
  total_customers: 40,
  returning_customers: 6,
  total_products: 25,
  inactive_products: 2,
  low_stock_products: 4,
  out_of_stock_products: 1,
  total_refund_amount: 500,
  total_returns: 1,
  average_order_value: 1000,
  return_rate: 8.3,
  revenue_growth_percentage: 20,
  order_growth_percentage: 20,
  processing_orders: 2,
  shipped_orders: 1,
  delivered_orders: 6,
  pending_returns: 1,
  approved_returns: 0,
  products_sold: 37,
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'content-range': '0-0/1',
};

async function seedAdminSession(page: Page, isAdmin: boolean) {
  test.skip(!STORAGE_KEY, 'VITE_SUPABASE_URL unavailable — Supabase client not configured');
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => window.localStorage.setItem(key, value),
    { key: STORAGE_KEY!, value: fakeSession() },
  );

  // Role gate: admin_users membership decides isAdmin in AuthContext.
  await page.route('**/rest/v1/admin_users*', route =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      json: isAdmin ? [{ user_id: USER_ID }] : [],
    }),
  );

  // Safety nets so nothing ever reaches the live auth backend.
  await page.route('**/auth/v1/**', route =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      json: { id: USER_ID, aud: 'authenticated', email: 'e2e-admin@nerve.test' },
    }),
  );
}

async function mockOrders(page: Page, orders: unknown[] = [ORDER]) {
  await page.route('**/rest/v1/orders*', route =>
    route.fulfill({ status: 200, headers: jsonHeaders, json: orders }),
  );
}

test.describe('Admin — access control', () => {
  test('signed-in admin sees the dashboard with operational KPIs', async ({ page }) => {
    await seedAdminSession(page, true);
    await mockOrders(page);
    await page.route('**/rest/v1/rpc/get_dashboard_overview*', route =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        json: [DASHBOARD_ROW],
      }),
    );
    await page.route('**/rest/v1/order_items*', route =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        json: [],
      }),
    );
    await page.route('**/rest/v1/product_inventory*', route =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        json: [],
      }),
    );

    await page.goto('/admin', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('admin-dashboard')).toBeVisible();

    // Needs-attention tiles carry the RPC's operational counts.
    await expect(page.getByTestId('attention-pending-orders-count')).toHaveText('3');
    await expect(page.getByTestId('attention-low-stock-count')).toHaveText('4');
    await expect(page.getByTestId('attention-pending-returns-count')).toHaveText('1');

    // Fulfillment strip + recent orders are real data, not placeholders.
    const strip = page.getByTestId('status-strip');
    await expect(strip).toContainText('Processing');
    await expect(strip).toContainText('2');
    await expect(page.getByTestId('recent-orders')).toContainText('NV-1001');
    await expect(page.getByRole('heading', { name: 'Best Selling Products' })).toBeVisible();

    // Dead nav links from the audit are gone.
    await expect(page.getByRole('link', { name: 'Analytics' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Audit Logs' })).toHaveCount(0);
  });

  test('signed-in non-admin is denied with a visible Access Denied screen', async ({ page }) => {
    await seedAdminSession(page, false);

    await page.goto('/admin/orders', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('admin-access-denied')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    // The orders UI must never mount for a non-admin.
    await expect(page.getByTestId('orders-table')).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\/orders/);
  });
});

test.describe('Admin — order operations', () => {
  test('invalid transitions are disabled and a valid change posts the right payload', async ({
    page,
  }) => {
    await seedAdminSession(page, true);
    await mockOrders(page);

    const functionCalls: { orderId?: string; status?: string }[] = [];
    await page.route('**/functions/v1/update-order-status', async route => {
      functionCalls.push((route.request().postDataJSON() ?? {}) as { orderId?: string });
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        json: { order: { ...ORDER, status: 'processing' } },
      });
    });

    await page.goto('/admin/orders', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('orders-table')).toBeVisible();

    const select = page.getByTestId('order-status-NV-1001');
    await expect(select).toBeVisible();

    // From "placed": processing/cancelled allowed, everything else disabled.
    await expect(select.locator('option[value="processing"]')).toBeEnabled();
    await expect(select.locator('option[value="cancelled"]')).toBeEnabled();
    await expect(select.locator('option[value="shipped"]')).toBeDisabled();
    await expect(select.locator('option[value="delivered"]')).toBeDisabled();
    await expect(select.locator('option[value="refunded"]')).toBeDisabled();

    // A valid change goes through the edge function (server-side enforced).
    await select.selectOption('processing');
    await expect.poll(() => functionCalls.length, { timeout: 10000 }).toBeGreaterThan(0);
    expect(functionCalls[0].status).toBe('processing');
    expect(functionCalls[0].orderId).toBe(ORDER.id);
  });

  test('list search is a server-side query, not a client filter', async ({ page }) => {
    await seedAdminSession(page, true);
    await mockOrders(page);

    await page.goto('/admin/orders', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('orders-table')).toBeVisible();

    const searchPromise = page.waitForRequest(
      req =>
        req.url().includes('/rest/v1/orders') && decodeURIComponent(req.url()).includes('buyer'),
    );
    await page.getByTestId('orders-search-input').fill('buyer');
    const req = await searchPromise;
    const url = decodeURIComponent(req.url());
    expect(url).toContain('ilike'); // PostgREST or=(...) server-side filter
    expect(url).toContain('order_number'); // searches order number + email + name
  });
});

test.describe('Admin — product form validation', () => {
  async function openNewProductForm(page: Page) {
    await seedAdminSession(page, true);
    await page.route('**/rest/v1/collections*', route =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        json: [],
      }),
    );
    // Any product write in these tests would mean validation was bypassed.
    const writes: Request[] = [];
    await page.route('**/rest/v1/products*', async route => {
      if (route.request().method() !== 'GET') writes.push(route.request());
      await route.fulfill({
        status: 201,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        json: [],
      });
    });

    await page.goto('/admin/products/new', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'New Product' })).toBeVisible();
    return writes;
  }

  test('price of 0 cannot be saved', async ({ page }) => {
    const writes = await openNewProductForm(page);

    await page.getByTestId('product-name-input').fill('Zero Price Product');
    await page.getByTestId('product-price-input').fill('0');
    await page.getByTestId('product-description-input').fill('Validation fixture.');
    await page.getByTestId('product-material-input').fill('Cotton');
    await page.getByTestId('product-save-button').click();

    // The number input's min=0.01 blocks submission at the browser layer…
    const priceValid = await page
      .getByTestId('product-price-input')
      .evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(priceValid).toBe(false);
    // …and no product write ever happens.
    await page.waitForTimeout(300);
    expect(writes).toHaveLength(0);
    await expect(page).toHaveURL(/\/admin\/products\/new/);
  });

  test('compare-at price below the selling price is rejected before any write', async ({
    page,
  }) => {
    const writes = await openNewProductForm(page);

    await page.getByTestId('product-name-input').fill('Compare At Product');
    await page.getByTestId('product-price-input').fill('399');
    await page.getByTestId('product-compare-at-input').fill('200');
    await page.getByTestId('product-description-input').fill('Validation fixture.');
    await page.getByTestId('product-material-input').fill('Cotton');
    await page.getByTestId('product-save-button').click();

    await expect(
      page.getByText('Compare-at price must be higher than the selling price.'),
    ).toBeVisible();
    await page.waitForTimeout(300);
    expect(writes).toHaveLength(0);
    await expect(page).toHaveURL(/\/admin\/products\/new/);
  });
});

test.describe('Admin — responsive dashboard', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('orders page works at 375px with a hamburger drawer', async ({ page }) => {
    await seedAdminSession(page, true);
    await mockOrders(page);
    await page.route('**/rest/v1/products*', route =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'content-range': '0-0/0' },
        json: [],
      }),
    );

    await page.goto('/admin/orders', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('orders-table')).toBeVisible();

    // Hamburger opens the off-canvas sidebar…
    const sidebar = page.locator('nav').first();
    await expect(sidebar).not.toHaveClass(/(^|\s)translate-x-0(\s|$)/);
    await page.getByTestId('admin-menu-button').click();
    await expect(sidebar).toHaveClass(/(^|\s)translate-x-0(\s|$)/);
    await expect(page.locator('[role="presentation"]')).toBeVisible();

    // …and navigating from it lands on the target page with the drawer closed.
    await sidebar.getByRole('link', { name: 'Products' }).click();
    await page.waitForURL(/\/admin\/products/);
    await expect(sidebar).not.toHaveClass(/(^|\s)translate-x-0(\s|$)/);
    await expect(
      page.getByTestId('products-table').or(page.getByTestId('products-empty')),
    ).toBeVisible();
  });
});
