import { test, expect, type Page } from '@playwright/test';
import { skipGuard } from './skipGuard';

/**
 * Admin CRUD smoke: sign in as admin, open /admin, create a product, assert
 * navigation back to the products table.
 *
 * Requires live admin credentials:
 *   ADMIN_TEST_EMAIL=admin@example.com
 *   ADMIN_TEST_PASSWORD=...
 * Skipped entirely when unset so local CI without secrets still passes.
 */

const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD;
const HAVE_ADMIN_CREDS = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

// TEST-03: fixture-driven skips below stay skips locally, but become CI
// failures whenever admin credentials are configured (seed admin + catalog
// fixtures in CI — see GO_LIVE_CHECKLIST 'E2E fixtures').

async function loginAsAdmin(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.getByTestId('login-email-input').fill(ADMIN_EMAIL!);
  await page.getByTestId('login-password-input').fill(ADMIN_PASSWORD!);
  await page.getByTestId('login-button').click();
  await page.waitForURL(/\/account/, { timeout: 15000 });
}

test.describe('Admin — product CRUD', () => {
  test.beforeEach(() => {
    // TEST-03: no admin credentials in this environment — structural skip
    // (failInCi: false until CI seeds ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD).
    skipGuard(
      !HAVE_ADMIN_CREDS,
      'ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD not set — admin CRUD requires live credentials',
      { failInCi: false },
    );
  });

  test('admin can open dashboard and navigate to products', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin', { waitUntil: 'networkidle' });
    // Admin guard redirects non-admins; if we land here as admin, dashboard renders
    const onLogin = page.url().includes('/login');
    // TEST-03: creds present but not an admin_users row — CI failure (misconfigured fixture)
    skipGuard(onLogin, 'Signed-in user is not an admin_users row — skipping admin suite', {
      failInCi: HAVE_ADMIN_CREDS,
    });

    await expect(page.getByTestId('admin-dashboard')).toBeVisible();
    await page.getByRole('link', { name: /^products$/i }).click();
    await page.waitForURL(/\/admin\/products/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /^products$/i })).toBeVisible();
  });

  test('create a product via the admin form and return to the list', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin/products', { waitUntil: 'networkidle' });
    const onLogin = page.url().includes('/login');
    // TEST-03: creds present but not an admin_users row — CI failure (misconfigured fixture)
    skipGuard(onLogin, 'Signed-in user is not an admin_users row — skipping admin suite', {
      failInCi: HAVE_ADMIN_CREDS,
    });

    await expect(page.getByTestId('new-product-link')).toBeVisible();
    await page.getByTestId('new-product-link').click();
    await page.waitForURL(/\/admin\/products\/new/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /new product/i })).toBeVisible();

    const stamp = Date.now();
    const name = `E2E Fixture ${stamp}`;
    await page.getByTestId('product-name-input').fill(name);
    await page.getByTestId('product-price-input').fill('399');
    await page.getByTestId('product-description-input').fill('Playwright CRUD fixture product.');
    await page.getByTestId('product-material-input').fill('Cotton');
    await page.getByTestId('product-save-button').click();

    // Success → navigate back to /admin/products with the list/table visible
    // Failure (RLS/network) → inline error on the form; skip so secretless CI passes.
    const returnedToList = await page
      .waitForURL(/\/admin\/products$/, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);

    // TEST-03: save failed while admin creds are configured — CI failure (RLS/network regression)
    skipGuard(
      !returnedToList,
      'Product save did not navigate back (RLS/network/admin service unavailable) — skipping list assertions',
      { failInCi: HAVE_ADMIN_CREDS },
    );

    await expect(page.getByTestId('products-table')).toBeVisible();
    await expect(page.getByRole('cell', { name })).toBeVisible();
  });

  test('edit an existing product form loads with testids', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin/products', { waitUntil: 'networkidle' });
    const onLogin = page.url().includes('/login');
    // TEST-03: creds present but not an admin_users row — CI failure (misconfigured fixture)
    skipGuard(onLogin, 'Signed-in user is not an admin_users row — skipping admin suite', {
      failInCi: HAVE_ADMIN_CREDS,
    });

    const table = page.getByTestId('products-table');
    const hasRows = await table.isVisible().catch(() => false);
    // TEST-03: empty catalog with admin creds — CI failure (seed catalog fixture)
    skipGuard(!hasRows, 'Products table not available', { failInCi: HAVE_ADMIN_CREDS });

    const firstEdit = page.getByRole('link', { name: /edit/i }).first();
    const hasEdit = await firstEdit.isVisible().catch(() => false);
    // TEST-03: catalog seeded without editable rows — CI failure
    skipGuard(!hasEdit, 'No editable product rows', { failInCi: HAVE_ADMIN_CREDS });

    await firstEdit.click();
    await page.waitForURL(/\/admin\/products\/[^/]+/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();
    await expect(page.getByTestId('product-name-input')).toBeVisible();
    await expect(page.getByTestId('product-save-button')).toBeVisible();
  });
});
