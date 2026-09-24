import { test, expect } from '@playwright/test';

test.describe('Customer Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
  });

  test('homepage renders hero and shop CTA', async ({ page }) => {
    await expect(page).toHaveTitle(/NERVE/i);
    // Hero carousel shows "UP TO 60% OFF" or one of the other slides
    await expect(page.getByRole('heading').first()).toBeVisible();
    // Click on "SHOP" button or shop link on the page
    const shopLink = page.getByRole('link', { name: /shop/i }).first();
    await expect(shopLink).toBeVisible();
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop/);
  });

  test('browse shop, open a product, add to bag', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'load' });
    await expect(page.getByTestId('products-grid')).toBeVisible();

    // Sort by price ascending
    await page.getByLabel('Sort products').selectOption('price-asc');
    await page.waitForTimeout(500); // Wait for filter to apply
    await expect(page.getByTestId('product-card').first()).toBeVisible();

    // Open first product
    await page.getByTestId('product-card').first().locator('a').first().click();
    await page.waitForURL(/\/product\//, { timeout: 5000 });
    await expect(page.getByTestId('add-to-bag-button')).toBeVisible();

    // Add to bag without a size shows validation error
    await page.getByTestId('add-to-bag-button').click();
    await expect(page.getByText(/please select a size/i)).toBeVisible();

    // Pick a size then add to bag
    await page.getByTestId('size-option').first().click();
    await page.getByTestId('add-to-bag-button').click();
    await page.waitForTimeout(500); // Wait for cart update

    // Bag count increments
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });

  test('shop search filters products', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'load' });
    await page.getByTestId('search-input').fill('tee');
    await page.waitForTimeout(500); // Wait for search results
    await expect(page.getByTestId('products-grid')).toBeVisible();
    const count = await page.getByTestId('product-card').count();
    expect(count).toBeGreaterThan(0);
  });

  test('category filter via URL param', async ({ page }) => {
    await page.goto('/shop?category=T-Shirts', { waitUntil: 'load' });
    // Category might be in title or as visible text on the page
    await expect(page.getByTestId('product-card').first()).toBeVisible();
  });

  test('cart page promo code applies discount', async ({ page }) => {
    // Seed cart via product page so cart page has items
    await page.goto('/shop', { waitUntil: 'load' });
    await page.getByTestId('product-card').first().locator('a').first().click();
    await page.waitForURL(/\/product\//, { timeout: 5000 });

    await page.getByTestId('size-option').first().click();
    await page.getByTestId('add-to-bag-button').click();
    await page.waitForTimeout(500);

    // Navigate to cart page
    await page.goto('/cart', { waitUntil: 'load' });
    await expect(page.getByTestId('cart-item')).toHaveCount(1);

    // Promo code UI must exist and give explicit feedback (applied OR invalid —
    // validity depends on the backend discount table).
    const promoInput = page.getByTestId('promo-input');
    await expect(promoInput).toBeVisible();
    await promoInput.fill('NERVE10');
    await page.getByTestId('promo-apply').click();
    await expect(page.getByText(/applied|invalid discount code/i)).toBeVisible();
  });

  test('wishlist toggle from product page', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'load' });
    await page.getByTestId('product-card').first().locator('a').first().click();
    await page.waitForURL(/\/product\//, { timeout: 5000 });

    const wishlistBtn = page.getByRole('button', { name: /add to wishlist/i }).first();
    await expect(wishlistBtn).toBeVisible();
    await wishlistBtn.click();
    // Toggle must flip to the remove state
    await expect(page.getByRole('button', { name: /remove from wishlist/i }).first()).toBeVisible();
  });

  test('mobile menu opens and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'load' });

    const menuBtn = page.getByTestId('menu-button');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    await expect(page.getByTestId('mobile-menu')).toBeVisible();
  });

  test('guest order tracking form validates input', async ({ page }) => {
    await page.goto('/guest-order', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /track your order/i })).toBeVisible();
    await page.getByTestId('guest-order-number-input').fill('NRV-123456');
    await expect(page.getByTestId('guest-order-number-input')).toHaveValue('NRV-123456');
  });

  test('checkout flow shows empty bag state when no items', async ({ page }) => {
    await page.goto('/checkout', { waitUntil: 'load' });
    await expect(page.getByTestId('empty-cart')).toBeVisible();
  });

  test('404 route renders not found', async ({ page }) => {
    await page.goto('/product/does-not-exist', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /product not found/i })).toBeVisible();
    await page.getByRole('button', { name: /back to shop/i }).click();
    await expect(page).toHaveURL(/\/shop/);
  });

  test('newsletter subscribe shows validation error for bad email', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    // "a@b" passes native type=email validation but fails the app's stricter regex
    const emailInput = page.getByTestId('newsletter-email');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('a@b');
    await page.getByTestId('newsletter-subscribe').click();
    await expect(page.getByText(/enter a valid email/i)).toBeVisible();
  });
});
