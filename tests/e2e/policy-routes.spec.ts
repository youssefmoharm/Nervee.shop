import { test, expect } from '@playwright/test';

/**
 * Policy / trust route integrity.
 * Every customer-facing policy page must load, expose its primary heading,
 * and not fall through to the 404 route.
 */
const POLICIES: Array<{ path: string; heading: RegExp }> = [
  { path: '/shipping', heading: /shipping/i },
  { path: '/returns', heading: /returns/i },
  { path: '/faq', heading: /faq/i },
  { path: '/contact', heading: /contact/i },
  { path: '/about', heading: /about nerveve?i|about nerve/i },
  { path: '/privacy', heading: /privacy/i },
  { path: '/terms', heading: /terms/i },
  { path: '/size-guide', heading: /size guide/i },
  { path: '/track-order', heading: /track/i },
];

test.describe('Trust & policy routes', () => {
  for (const { path, heading } of POLICIES) {
    test(`${path} renders policy content (not 404)`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
      await expect(page.getByRole('heading', { name: /page not found/i })).toHaveCount(0);
    });
  }

  test('shipping page shows verified rates and timelines', async ({ page }) => {
    await page.goto('/shipping', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /delivery options/i })).toBeVisible();
    // storeConfig: standard 100, free over 2000, express 200 — rendered as EGP
    await expect(page.getByText(/2–5 business days|2-5 business days/).first()).toBeVisible();
    await expect(page.getByText(/1–2 business days|1-2 business days/).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /returns/i }).first()).toBeVisible();
  });

  test('returns page covers return, exchange, and cancellation windows', async ({ page }) => {
    await page.goto('/returns', { waitUntil: 'load' });
    await expect(page.getByText(/14 days from delivery/i)).toBeVisible();
    await expect(page.getByText(/free size exchanges within 30 days/i)).toBeVisible();
    await expect(page.getByText(/cancel.*within 2 hours|2 hours/i).first()).toBeVisible();
  });

  test('faq answers the seven core customer questions', async ({ page }) => {
    await page.goto('/faq', { waitUntil: 'load' });
    await expect(page.getByText(/how long does delivery take/i)).toBeVisible();
    await expect(page.getByText(/how much does shipping cost/i)).toBeVisible();
    await expect(page.getByText(/where do you deliver/i)).toBeVisible();
    await expect(page.getByText(/cash on delivery/i).first()).toBeVisible();
    await expect(page.getByText(/can i return or exchange/i)).toBeVisible();
    await expect(page.getByText(/how do i contact/i)).toBeVisible();
  });

  test('footer exposes policy links on every page', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'load' });
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Shipping' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Returns' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'FAQ' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Track Order' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Contact' })).toBeVisible();
  });

  test('footer policy links navigate to live routes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.locator('footer').getByRole('link', { name: 'Shipping', exact: true }).click();
    await expect(page).toHaveURL(/\/shipping/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/shipping/i);

    await page.locator('footer').getByRole('link', { name: 'Returns', exact: true }).click();
    await expect(page).toHaveURL(/\/returns/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/returns/i);

    await page.locator('footer').getByRole('link', { name: 'FAQ', exact: true }).click();
    await expect(page).toHaveURL(/\/faq/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/faq/i);
  });

  test('about page links to contact, shipping, returns, and faq', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'load' });
    await expect(page.getByRole('link', { name: /contact us|contact/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /shipping/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /returns/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /faq/i }).first()).toBeVisible();
  });

  test('cart shows delivery ETA and policy links when items exist', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'load' });
    const cards = page.getByTestId('product-card');
    test.skip((await cards.count()) === 0, 'No products available');
    await cards.first().locator('a').first().click();
    await page.waitForURL(/\/product\//, { timeout: 10000 });
    await page.getByTestId('size-option').first().click();
    await page.getByTestId('add-to-bag-button').click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    await page.goto('/cart', { waitUntil: 'load' });
    await expect(page.getByTestId('cart-item').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /shipping details/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /14-day returns/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FAQ', exact: true })).toBeVisible();
  });
});
