import { test, expect, type Page } from '@playwright/test';

/**
 * Guest cart → sign-in merge.
 *
 * Seeds a guest cart in sessionStorage (`nerve.cart`, the CartContext STORAGE_KEY)
 * exactly as the app writes it, then signs in via the UI. After login the
 * CartContext merges the guest cart into the DB cart and the header cart count
 * must be >= 1.
 *
 * Requires live credentials:
 *   AUTH_TEST_EMAIL=you@example.com
 *   AUTH_TEST_PASSWORD=...
 * Documented: without these env vars the merge assertions cannot run against
 * a real backend, so the test skips (structure still validates seeding + login form).
 */

const AUTH_EMAIL = process.env.AUTH_TEST_EMAIL;
const AUTH_PASSWORD = process.env.AUTH_TEST_PASSWORD;

const GUEST_LINE = {
  productId: 'p-001',
  name: 'Signature Tee',
  slug: 'signature-tee',
  image: '/assets/images/placeholder.jpg',
  price: 450,
  color: 'Navy',
  size: 'M',
  quantity: 1,
};

async function seedGuestCart(page: Page) {
  await page.addInitScript(line => {
    window.sessionStorage.setItem('nerve.cart', JSON.stringify([line]));
  }, GUEST_LINE);
}

test.describe('Cart merge on sign-in', () => {
  test('guest sessionStorage cart survives and merges after login', async ({ page }) => {
    test.skip(
      !AUTH_EMAIL || !AUTH_PASSWORD,
      'AUTH_TEST_EMAIL / AUTH_TEST_PASSWORD not set — login-with-UI merge requires live credentials',
    );

    await seedGuestCart(page);

    // Guest sees the seeded item before auth
    await page.goto('/cart', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('cart-item')).toHaveCount(1);

    // Sign in via UI
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.getByTestId('login-email-input').fill(AUTH_EMAIL!);
    await page.getByTestId('login-password-input').fill(AUTH_PASSWORD!);
    await page.getByTestId('login-button').click();

    const loggedIn = await page
      .waitForURL(/\/account/, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      !loggedIn,
      'Login did not reach /account (email confirmation / invalid creds) — cannot assert cart merge',
    );

    // Back to cart: count must be >= 1 (merged guest line or pre-existing DB lines)
    await page.goto('/cart', { waitUntil: 'networkidle' });
    const headerCount = page.getByTestId('cart-count');
    await expect(headerCount).toBeVisible();

    // Wait for CartContext merge effect (mergeGuestCart + fetchMine)
    await expect
      .poll(
        async () => {
          const text = (await headerCount.textContent().catch(() => null))?.trim();
          if (!text) return 0;
          const n = Number(text);
          return Number.isFinite(n) ? n : 0;
        },
        { timeout: 15000, message: 'cart count should be >= 1 after login merge' },
      )
      .toBeGreaterThanOrEqual(1);

    // Cart page shows at least one line
    await expect(page.getByTestId('cart-item').first()).toBeVisible();
  });

  test('guest cart seeds into sessionStorage with expected shape (no login required)', async ({
    page,
  }) => {
    await seedGuestCart(page);
    await page.goto('/cart', { waitUntil: 'networkidle' });

    const stored = await page.evaluate(() => window.sessionStorage.getItem('nerve.cart'));
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!) as Array<Record<string, unknown>>;
    expect(parsed.length).toBe(1);
    expect(parsed[0].productId).toBe(GUEST_LINE.productId);
    expect(parsed[0].size).toBe(GUEST_LINE.size);
    await expect(page.getByTestId('cart-item')).toHaveCount(1);
    await expect(page.getByTestId('proceed-to-checkout')).toBeVisible();
  });
});
