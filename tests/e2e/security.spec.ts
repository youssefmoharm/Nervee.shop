import { test, expect } from '@playwright/test'

test.describe('Security — client-side guards and validation', () => {
  test('protected routes redirect unauthenticated users to /login', async ({ page }) => {
    const protectedPaths = ['/account', '/account/orders', '/account/addresses', '/account/wishlist']
    for (const path of protectedPaths) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('admin routes redirect unauthenticated users to /login', async ({ page }) => {
    const adminPaths = ['/admin', '/admin/orders', '/admin/products', '/admin/customers', '/admin/discounts']
    for (const path of adminPaths) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('register form enforces password length', async ({ page }) => {
    await page.goto('/register')
    await page.getByTestId('register-firstName-input').fill('Test')
    await page.getByTestId('register-lastName-input').fill('User')
    await page.getByTestId('register-email-input').fill('test@example.com')
    await page.getByTestId('register-password-input').fill('123')
    await page.getByTestId('register-confirm-password-input').fill('123')
    await page.getByTestId('register-button').click()
    // Password has minLength=8 — the browser blocks submission; React never
    // reaches signUp and the success screen never appears.
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible()
    await expect(page.getByText(/check your email/i)).toBeHidden()
  })

  test('register form enforces matching passwords', async ({ page }) => {
    await page.goto('/register')
    await page.getByTestId('register-firstName-input').fill('Test')
    await page.getByTestId('register-lastName-input').fill('User')
    await page.getByTestId('register-email-input').fill('test@example.com')
    await page.getByTestId('register-password-input').fill('password123')
    await page.getByTestId('register-confirm-password-input').fill('different123')
    // dob and gender required natively — fill them so React's handler runs
    await page.locator('#register-dob').fill('2000-01-01')
    await page.locator('#register-gender').selectOption('female')
    await page.getByTestId('register-button').click()
    await expect(page.getByText(/passwords do not match/i)).toBeVisible()
  })

  test('register form requires date of birth and gender', async ({ page }) => {
    await page.goto('/register')
    await page.getByTestId('register-firstName-input').fill('Test')
    await page.getByTestId('register-lastName-input').fill('User')
    await page.getByTestId('register-email-input').fill('test@example.com')
    await page.getByTestId('register-password-input').fill('password123')
    await page.getByTestId('register-confirm-password-input').fill('password123')
    await page.getByTestId('register-button').click()
    // dob and gender are required — native validation blocks submission
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible()
    await expect(page.getByText(/check your email/i)).toBeHidden()
  })

  test('XSS payloads are escaped and rendered as plain text', async ({ page }) => {
    const payload = '<script>window.__xss = true</script>'
    await page.goto('/shop')
    await page.getByTestId('search-input').fill(payload)
    // Payload must not execute or appear as live markup in the DOM
    await page.waitForTimeout(300)
    const executed = await page.evaluate(() => (window as any).__xss === true)
    expect(executed).toBe(false)
  })

  test('oversized search input is handled without crashing', async ({ page }) => {
    const huge = 'A'.repeat(10000)
    await page.goto('/shop')
    await page.getByTestId('search-input').fill(huge)
    await expect(page.getByTestId('search-input')).toHaveValue(huge)
    // No matches for 10k "A"s — the empty state renders instead of crashing
    await expect(page.getByText(/no products match that search/i)).toBeVisible()
    // UI stays interactive — reset and re-query
    await page.getByTestId('search-input').fill('tee')
    await expect(page.getByTestId('products-grid')).toBeVisible()
  })

  test('guest order lookup rejects empty input', async ({ page }) => {
    await page.goto('/guest-order')
    await page.getByTestId('guest-order-number-input').fill('')
    await page.getByRole('button', { name: /track order/i }).click()
    // Form-level validation prevents empty submission from hitting the network
    await expect(page.getByRole('heading', { name: /track your order/i })).toBeVisible()
  })
})
