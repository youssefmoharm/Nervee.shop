import { test, expect } from '@playwright/test'

test.describe('Customer Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('complete customer purchase flow - COD', async ({ page }) => {
    // 1. Browse homepage
    await expect(page).toHaveTitle(/NERVE/i)
    await expect(page.locator('[data-testid="hero-section"]')).toBeVisible()

    // 2. Navigate to shop
    await page.click('[data-testid="shop-link"]')
    await expect(page.locator('[data-testid="products-grid"]')).toBeVisible()

    // 3. Select a product
    await page.click('[data-testid="product-card"]:first-child')
    await expect(page.locator('[data-testid="product-details"]')).toBeVisible()

    // 4. Select color and size
    await page.click('[data-testid="color-option"]:first-child')
    await page.click('[data-testid="size-option"][data-size="M"]')

    // 5. Add to cart
    await page.click('[data-testid="add-to-cart-button"]')
    await expect(page.locator('[data-testid="cart-drawer"]')).toBeVisible()

    // 6. Verify cart item
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="cart-subtotal"]')).toContainText(/\d+/)

    // 7. Proceed to checkout
    await page.click('[data-testid="checkout-button"]')
    
    // 8. Should redirect to login if not authenticated
    await expect(page).toHaveURL(/.*\/(login|auth)/)

    // 9. Create account
    await page.click('[data-testid="register-link"]')
    await page.fill('[data-testid="firstName-input"]', 'John')
    await page.fill('[data-testid="lastName-input"]', 'Doe')
    await page.fill('[data-testid="email-input"]', `test-${Date.now()}@example.com`)
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirm-password-input"]', 'password123')
    await page.click('[data-testid="register-button"]')

    // 10. Fill checkout form
    await expect(page.locator('[data-testid="checkout-form"]')).toBeVisible()
    await page.fill('[data-testid="phone-input"]', '01234567890')
    await page.fill('[data-testid="address-input"]', '123 Main Street, Cairo, Egypt')
    await page.selectOption('[data-testid="governorate-select"]', 'cairo')
    await page.check('[data-testid="cod-radio"]')

    // 11. Place order
    await page.click('[data-testid="place-order-button"]')

    // 12. Verify order success
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible()
    await expect(page.locator('[data-testid="order-number"]')).toContainText(/ORDER-/)
  })

  test('existing customer login and purchase', async ({ page }) => {
    // 1. Go to login
    await page.click('[data-testid="login-link"]')

    // 2. Login with existing account
    await page.fill('[data-testid="email-input"]', 'existing@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    // 3. Should redirect to homepage or previous page
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    // 4. Browse and add product
    await page.click('[data-testid="shop-link"]')
    await page.click('[data-testid="product-card"]:first-child')
    await page.click('[data-testid="color-option"]:first-child')
    await page.click('[data-testid="size-option"][data-size="L"]')
    await page.click('[data-testid="add-to-cart-button"]')

    // 5. Quick checkout (customer data should be pre-filled)
    await page.click('[data-testid="checkout-button"]')
    await expect(page.locator('[data-testid="checkout-form"]')).toBeVisible()

    // 6. Verify pre-filled data exists
    await expect(page.locator('[data-testid="email-input"]')).toHaveValue(/.*@.*/)

    // 7. Complete purchase with card payment
    await page.check('[data-testid="card-radio"]')
    await page.click('[data-testid="place-order-button"]')

    // 8. Handle card payment flow
    if (await page.locator('[data-testid="payment-iframe"]').isVisible()) {
      // Mock card payment in test environment
      await page.fill('[data-testid="card-number"]', '4111111111111111')
      await page.fill('[data-testid="card-expiry"]', '12/25')
      await page.fill('[data-testid="card-cvc"]', '123')
      await page.click('[data-testid="pay-button"]')
    }

    // 9. Verify order completion
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible()
  })

  test('cart management across pages', async ({ page }) => {
    // 1. Add multiple items to cart
    await page.click('[data-testid="shop-link"]')
    
    // Add first product
    await page.click('[data-testid="product-card"]:nth-child(1)')
    await page.click('[data-testid="color-option"]:first-child')
    await page.click('[data-testid="size-option"][data-size="M"]')
    await page.click('[data-testid="add-to-cart-button"]')

    // Continue shopping
    await page.click('[data-testid="continue-shopping"]')

    // Add second product
    await page.click('[data-testid="product-card"]:nth-child(2)')
    await page.click('[data-testid="color-option"]:first-child')
    await page.click('[data-testid="size-option"][data-size="L"]')
    await page.click('[data-testid="add-to-cart-button"]')

    // 2. Verify cart count
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('2')

    // 3. Navigate to different pages and verify cart persists
    await page.click('[data-testid="about-link"]')
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('2')

    await page.click('[data-testid="home-link"]')
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('2')

    // 4. Modify cart quantities
    await page.click('[data-testid="cart-button"]')
    await page.click('[data-testid="increase-quantity"]:first-child')
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('3')

    // 5. Remove item from cart
    await page.click('[data-testid="remove-item"]:last-child')
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('2')

    // 6. Clear entire cart
    await page.click('[data-testid="clear-cart"]')
    await page.click('[data-testid="confirm-clear"]')
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('0')
    await expect(page.locator('[data-testid="empty-cart-message"]')).toBeVisible()
  })

  test('product search and filtering', async ({ page }) => {
    await page.click('[data-testid="shop-link"]')

    // 1. Test search functionality
    await page.fill('[data-testid="search-input"]', 'shirt')
    await page.press('[data-testid="search-input"]', 'Enter')

    await expect(page.locator('[data-testid="search-results"]')).toBeVisible()
    await expect(page.locator('[data-testid="product-card"]')).toHaveCount.greaterThan(0)

    // 2. Clear search
    await page.click('[data-testid="clear-search"]')
    await expect(page.locator('[data-testid="all-products"]')).toBeVisible()

    // 3. Test category filtering
    await page.click('[data-testid="category-tshirts"]')
    await expect(page).toHaveURL(/.*category=t-shirts/)
    await expect(page.locator('[data-testid="category-title"]')).toContainText('T-Shirts')

    // 4. Test price sorting
    await page.selectOption('[data-testid="sort-select"]', 'price-asc')
    await expect(page).toHaveURL(/.*sort=price-asc/)
    
    const prices = await page.locator('[data-testid="product-price"]').allTextContents()
    const numericPrices = prices.map(p => parseFloat(p.replace(/[^\d.]/g, '')))
    const sortedPrices = [...numericPrices].sort((a, b) => a - b)
    expect(numericPrices).toEqual(sortedPrices)

    // 5. Test size filtering
    await page.click('[data-testid="size-filter-m"]')
    await expect(page).toHaveURL(/.*size=m/)
    
    // Verify all products show size M as available
    const sizeIndicators = page.locator('[data-testid="available-sizes"]')
    for (const indicator of await sizeIndicators.all()) {
      await expect(indicator).toContainText('M')
    }
  })

  test('wishlist functionality', async ({ page }) => {
    // Need to be logged in for wishlist
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    // 1. Add items to wishlist
    await page.click('[data-testid="shop-link"]')
    await page.click('[data-testid="wishlist-heart"]:first-child')
    await expect(page.locator('[data-testid="wishlist-heart"]:first-child')).toHaveClass(/filled/)

    await page.click('[data-testid="wishlist-heart"]:nth-child(2)')
    await expect(page.locator('[data-testid="wishlist-count"]')).toContainText('2')

    // 2. View wishlist
    await page.click('[data-testid="account-link"]')
    await page.click('[data-testid="wishlist-tab"]')
    await expect(page.locator('[data-testid="wishlist-items"]')).toHaveCount(2)

    // 3. Add wishlist item to cart
    await page.click('[data-testid="add-to-cart-from-wishlist"]:first-child')
    await expect(page.locator('[data-testid="cart-count"]')).toContainText(/[1-9]/)

    // 4. Remove from wishlist
    await page.click('[data-testid="remove-from-wishlist"]:first-child')
    await expect(page.locator('[data-testid="wishlist-items"]')).toHaveCount(1)
  })

  test('responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // 1. Test mobile navigation
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible()
    await page.click('[data-testid="mobile-menu-button"]')
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()

    // 2. Navigate on mobile
    await page.click('[data-testid="mobile-shop-link"]')
    await expect(page.locator('[data-testid="products-grid"]')).toBeVisible()

    // 3. Test product card on mobile
    await page.click('[data-testid="product-card"]:first-child')
    await expect(page.locator('[data-testid="product-images-mobile"]')).toBeVisible()

    // 4. Test mobile cart
    await page.click('[data-testid="color-option"]:first-child')
    await page.click('[data-testid="size-option"][data-size="M"]')
    await page.click('[data-testid="add-to-cart-button"]')
    await expect(page.locator('[data-testid="mobile-cart-drawer"]')).toBeVisible()

    // 5. Test mobile checkout
    await page.click('[data-testid="mobile-checkout-button"]')
    await expect(page.locator('[data-testid="mobile-checkout-form"]')).toBeVisible()

    // Verify form is properly formatted on mobile
    await expect(page.locator('[data-testid="checkout-form"]')).toHaveCSS('width', /100%|375px/)
  })

  test('error handling and recovery', async ({ page }) => {
    // 1. Test network error handling
    await page.route('**/api/**', route => route.abort())
    
    await page.click('[data-testid="shop-link"]')
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()

    // 2. Test retry functionality
    await page.unroute('**/api/**')
    await page.click('[data-testid="retry-button"]')
    await expect(page.locator('[data-testid="products-grid"]')).toBeVisible()

    // 3. Test invalid product URL
    await page.goto('/product/non-existent-product')
    await expect(page.locator('[data-testid="not-found-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="back-to-shop"]')).toBeVisible()

    await page.click('[data-testid="back-to-shop"]')
    await expect(page.locator('[data-testid="products-grid"]')).toBeVisible()

    // 4. Test form validation errors
    await page.goto('/login')
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible()

    // 5. Test invalid login recovery
    await page.fill('[data-testid="email-input"]', 'invalid@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="forgot-password-link"]')).toBeVisible()
  })
})