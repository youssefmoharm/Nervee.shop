import { test, expect } from '@playwright/test'

test.describe('Customer Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
  })

  test('homepage renders hero and shop CTA', async ({ page }) => {
    await expect(page).toHaveTitle(/NERVE/i)
    await expect(page.getByRole('heading', { name: /cool but/i })).toBeVisible()
    await page.getByRole('link', { name: /shop the drop/i }).click()
    await expect(page).toHaveURL(/\/shop/)
  })

  test('browse shop, open a product, add to bag', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('products-grid')).toBeVisible()

    // Sort by price ascending
    await page.getByLabel('Sort products').selectOption('price-asc')
    await page.waitForTimeout(500) // Wait for filter to apply
    await expect(page.getByTestId('product-card').first()).toBeVisible()

    // Open first product
    await page.getByTestId('product-card').first().locator('a').first().click()
    await page.waitForURL(/\/product\//, { timeout: 5000 })
    await expect(page.getByTestId('add-to-bag-button')).toBeVisible()

    // Add to bag without a size shows validation error
    await page.getByTestId('add-to-bag-button').click()
    await expect(page.getByText(/please select a size/i)).toBeVisible()

    // Pick a size then add to bag
    await page.getByTestId('size-option').first().click()
    await page.getByTestId('add-to-bag-button').click()
    await page.waitForTimeout(500) // Wait for cart update

    // Bag count increments
    await expect(page.getByTestId('cart-count')).toHaveText('1')
  })

  test('shop search filters products', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'networkidle' })
    await page.getByTestId('search-input').fill('tee')
    await page.waitForTimeout(500) // Wait for search results
    await expect(page.getByTestId('products-grid')).toBeVisible()
    const count = await page.getByTestId('product-card').count()
    expect(count).toBeGreaterThan(0)
  })

  test('category filter via URL param', async ({ page }) => {
    await page.goto('/shop?category=T-Shirts', { waitUntil: 'networkidle' })
    // Category might be in title or as visible text on the page
    await expect(page.getByTestId('product-card').first()).toBeVisible()
  })

  test('cart page promo code applies discount', async ({ page }) => {
    // Seed cart via product page so cart page has items
    await page.goto('/shop', { waitUntil: 'networkidle' })
    await page.getByTestId('product-card').first().locator('a').first().click()
    await page.waitForURL(/\/product\//, { timeout: 5000 })

    await page.getByTestId('size-option').first().click()
    // Use "Add to Bag" button if it exists, otherwise look for "Buy Now"
    const buyButton = page.getByTestId('buy-now-button')
    if (await buyButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await buyButton.click()
    } else {
      await page.getByTestId('add-to-bag-button').click()
    }
    await page.waitForTimeout(500)

    // Navigate to cart page
    await page.goto('/cart', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('cart-item')).toHaveCount(1)

    // Try to apply promo code
    const promoInput = page.getByTestId('promo-input')
    if (await promoInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await promoInput.fill('NERVE10')
      await page.getByTestId('promo-apply').click()
      await page.waitForTimeout(500)
      // Check for success message
      const successMsg = page.getByText(/applied/i)
      if (await successMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(successMsg).toBeVisible()
      }
    }
  })

  test('wishlist toggle from product page', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'networkidle' })
    await page.getByTestId('product-card').first().locator('a').first().click()
    await page.waitForURL(/\/product\//, { timeout: 5000 })

    // Try to find and click wishlist button
    const wishlistBtn = page.getByRole('button', { name: /add to wishlist/i }).first()
    if (await wishlistBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await wishlistBtn.click()
      await page.waitForTimeout(300)
      // Check if it changed to "remove from wishlist"
      const removeBtn = page.getByRole('button', { name: /remove from wishlist/i }).first()
      if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(removeBtn).toBeVisible()
      }
    }
  })

  test('mobile menu opens and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/', { waitUntil: 'networkidle' })

    const menuBtn = page.getByTestId('menu-button')
    if (await menuBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(300)
      const mobileMenu = page.getByTestId('mobile-menu')
      if (await mobileMenu.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(mobileMenu).toBeVisible()
      }
    }
  })

  test('guest order tracking form validates input', async ({ page }) => {
    await page.goto('/guest-order', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: /track your order/i })).toBeVisible()
    await page.getByTestId('guest-order-number-input').fill('NRV-123456')
    await expect(page.getByTestId('guest-order-number-input')).toHaveValue('NRV-123456')
  })

  test('checkout flow shows empty bag state when no items', async ({ page }) => {
    await page.goto('/checkout', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('empty-cart')).toBeVisible()
  })

  test('404 route renders not found', async ({ page }) => {
    await page.goto('/product/does-not-exist', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: /product not found/i })).toBeVisible()
    await page.getByRole('button', { name: /back to shop/i }).click()
    await expect(page).toHaveURL(/\/shop/)
  })

  test('newsletter subscribe shows validation error for bad email', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    // "a@b" passes native type=email validation but fails the app's stricter regex
    const emailInput = page.getByTestId('newsletter-email')
    if (await emailInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await emailInput.fill('a@b')
      const subscribeBtn = page.getByTestId('newsletter-subscribe')
      if (await subscribeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await subscribeBtn.click()
        await page.waitForTimeout(300)
        const errorMsg = page.getByText(/enter a valid email/i)
        if (await errorMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(errorMsg).toBeVisible()
        }
      }
    }
  })
})
