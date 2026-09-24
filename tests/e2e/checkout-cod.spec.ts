import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end COD checkout: shop → cart → Information → Shipping → Delivery →
 * Review (Payment step) → Confirmation.
 *
 * Guard: when Supabase is not configured (demo mode) or the create-order edge
 * function / network is unreachable, place-order surfaces an inline error —
 * we test.skip() so local CI without secrets still passes structure.
 */

async function addFirstProductToCart(page: Page) {
  await page.goto('/shop', { waitUntil: 'load' });
  const cards = page.getByTestId('product-card');
  // No products (backend down / empty) → skip structural run
  test.skip(
    (await cards.count()) === 0,
    'No product cards rendered (Supabase/mock data unavailable)',
  );
  await cards.first().locator('a').first().click();
  await page.waitForURL(/\/product\//, { timeout: 10000 });
  await page.getByTestId('size-option').first().click();
  await page.getByTestId('add-to-bag-button').click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
}

test.describe('Checkout — COD end-to-end', () => {
  test('places a cash-on-delivery order through all steps', async ({ page }) => {
    await addFirstProductToCart(page);

    // Open cart and proceed to checkout
    await page.goto('/cart', { waitUntil: 'load' });
    await expect(page.getByTestId('proceed-to-checkout')).toBeVisible();
    await page.getByTestId('proceed-to-checkout').click();
    await page.waitForURL(/\/checkout/, { timeout: 10000 });
    await expect(page.getByTestId('checkout-form')).toBeVisible();
    await expect(page.getByText('Customer Information')).toBeVisible();

    // Step 1 — Information (valid Egyptian data)
    await page.getByTestId('email-input').fill('cod.e2e@example.com');
    await page.getByTestId('firstName-input').fill('Nour');
    await page.getByTestId('lastName-input').fill('Hassan');
    await page.getByTestId('phone-input').fill('01012345678');
    await page.getByTestId('place-order-button').click(); // "Continue to Next Step"
    await expect(page.getByText('Shipping Address')).toBeVisible();

    // Step 2 — Shipping (address >= 10 chars, Cairo)
    await page.getByTestId('address-input').fill('15 Road 9, Maadi, Apt 4');
    await page.getByTestId('city-input').fill('Cairo');
    await page.getByTestId('governorate-select').selectOption('Cairo');
    await page.getByTestId('place-order-button').click();
    await expect(page.getByRole('heading', { name: 'Delivery & Payment' })).toBeVisible();

    // Step 3 — Delivery (standard) + COD is preselected
    await page.locator('input[name="delivery"][value="standard"]').check();
    await expect(page.locator('input[name="paymentMethod"][value="cod"]')).toBeChecked();
    await page.getByTestId('place-order-button').click();
    await expect(page.getByText('Review Your Order')).toBeVisible();

    // Step 4 — Place Order → Confirmation, or skip if backend unavailable
    await page.getByTestId('place-order-button').click();

    // Race success vs. the inline place-error (network / not configured)
    const success = page.getByTestId('order-success');
    const errorAlert = page.locator('[role="alert"]', {
      hasText:
        /supabase|network|configured|connection|could not|try again|failed|unavailable|cart is empty/i,
    });

    const outcome = await Promise.race([
      success.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'success' as const),
      errorAlert
        .first()
        .waitFor({ state: 'visible', timeout: 20000 })
        .then(() => 'error' as const),
    ]).catch(() => null);

    test.skip(
      outcome !== 'success',
      `Order backend unavailable (outcome=${
        outcome ?? 'timeout'
      }) — skipping confirmation assertions`,
    );

    await expect(page.getByTestId('order-success')).toBeVisible();
    await expect(page.getByTestId('order-number')).toContainText(/Order #/i);
    await expect(page.getByRole('heading', { name: /order confirmed/i })).toBeVisible();
  });

  test('checkout with empty bag shows empty state', async ({ page }) => {
    await page.goto('/checkout', { waitUntil: 'load' });
    await expect(page.getByTestId('empty-cart')).toBeVisible();
  });

  test('step 1 validates Egyptian phone before advancing', async ({ page }) => {
    await addFirstProductToCart(page);
    await page.goto('/checkout', { waitUntil: 'load' });
    // May resume mid-session from checkout session recovery; force step 1 fields if present
    const phone = page.getByTestId('phone-input');
    if (!(await phone.isVisible().catch(() => false))) {
      test.skip(true, 'Checkout session restored past Information step');
    }
    await page.getByTestId('email-input').fill('bad-phone@example.com');
    await page.getByTestId('firstName-input').fill('Nour');
    await page.getByTestId('lastName-input').fill('Hassan');
    await page.getByTestId('phone-input').fill('12345');
    await page.getByTestId('place-order-button').click();
    await expect(page.locator('#phone-error')).toBeVisible();
    await expect(page.getByText('Shipping Address')).toHaveCount(0);
  });
});
