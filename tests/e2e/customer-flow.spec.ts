import { test, expect } from '@playwright/test'

test.describe('Customer Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('homepage renders hero and shop CTA', async ({ page }) => {
    await expect(page).toHaveTitle(/NERVE/i)
    await expect(page.getByRole('heading', { name: /cool but/i })).toBeVisible()
    await page.getByRole('link', { name: /shop the drop/i }).click()
    await expect(page).toHaveURL(/\/shop/)
  })

  test('browse shop, open a product, add to bag', async ({ page }) => {
    await page.goto('/shop')
    await expect(page.getByTestId('products-grid')).toBeVisible()

    // Sort by price ascending
    await page.getByLabel('Sort products').selectOption('price-asc')
    await expect(page.getByTestId('product-card').first()).toBeVisible()

    // Open first product
    await page.getByTestId('product-card').first().locator('a[aria-label]').first().click()
    await expect(page).toHaveURL(/\/product\//)
    await expect(page.getByTestId('add-to-bag-button')).toBeVisible()

    // Add to bag without a size shows validation error
    await page.getByTestId('add-to-bag-button').click()
    await expect(page.getByText(/please select a size/i)).toBeVisible()

    // Pick a size then add to bag
    await page.getByTestId('size-option').first().click()
    await page.getByTestId('add-to-bag-button').click()

    // Bag count increments
    await expect(page.getByTestId('cart-count')).toHaveText('1')
  })

  test('shop search filters products', async ({ page }) => {
    await page.goto('/shop')
    await page.getByTestId('search-input').fill('tee')
    await expect(page.getByTestId('products-grid')).toBeVisible()
    const count = await page.getByTestId('product-card').count()
    expect(count).toBeGreaterThan(0)
  })

  test('category filter via URL param', async ({ page }) => {
    await page.goto('/shop?category=T-Shirts')
    await expect(page.getByRole('heading', { name: /T-Shirts/i })).toBeVisible()
    await expect(page.getByTestId('product-card').first()).toBeVisible()
  })

  test('cart page promo code applies discount', async ({ page }) => {
    // Seed cart via product page so cart page has items
    await page.goto('/shop')
    await page.getByTestId('product-card').first().locator('a[aria-label]').first().click()
    await page.getByTestId('size-option').first().click()
    await page.getByTestId('buy-now-button').click()

    // Buy Now opens the cart drawer
    await expect(page.getByTestId('cart-drawer')).toBeVisible()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expect(page.getByTestId('cart-subtotal')).toContainText(/EGP/)

    await page.getByTestId('cart-drawer').getByRole('link', { name: /view bag/i }).click()
    await expect(page).toHaveURL(/\/cart/)

    await page.getByTestId('promo-input').fill('NERVE10')
    await page.getByTestId('promo-apply').click()
    await expect(page.getByText(/Code NERVE10 applied/i)).toBeVisible()
  })

  test('wishlist toggle from product page', async ({ page }) => {
    await page.goto('/shop')
    await page.getByTestId('product-card').first().locator('a[aria-label]').first().click()
    // Use the product page's own wishlist button (related-product cards also have one)
    await page.getByRole('button', { name: /add to wishlist/i }).first().click()
    await expect(page.getByRole('button', { name: /remove from wishlist/i }).first()).toBeVisible()
  })

  test('mobile menu opens and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.getByTestId('menu-button').click()
    await expect(page.getByTestId('mobile-menu')).toBeVisible()
    await page.getByTestId('mobile-menu').getByRole('link', { name: /^Shop$/ }).click()
    await expect(page).toHaveURL(/\/shop/)
    await expect(page.getByTestId('products-grid')).toBeVisible()
  })

  test('guest order tracking form validates input', async ({ page }) => {
    await page.goto('/guest-order')
    await expect(page.getByRole('heading', { name: /track your order/i })).toBeVisible()
    await page.getByTestId('guest-order-number-input').fill('NRV-123456')
    await expect(page.getByTestId('guest-order-number-input')).toHaveValue('NRV-123456')
  })

  test('checkout flow shows empty bag state when no items', async ({ page }) => {
    await page.goto('/checkout')
    await expect(page.getByTestId('empty-cart')).toBeVisible()
  })

  test('404 route renders not found', async ({ page }) => {
    await page.goto('/product/does-not-exist')
    await expect(page.getByRole('heading', { name: /product not found/i })).toBeVisible()
    await page.getByRole('button', { name: /back to shop/i }).click()
    await expect(page).toHaveURL(/\/shop/)
  })

  test('newsletter subscribe shows validation error for bad email', async ({ page }) => {
    // "a@b" passes native type=email validation but fails the app's stricter regex
    await page.getByTestId('newsletter-email').fill('a@b')
    await page.getByTestId('newsletter-subscribe').click()
    await expect(page.getByText(/enter a valid email/i)).toBeVisible()
  })
})
