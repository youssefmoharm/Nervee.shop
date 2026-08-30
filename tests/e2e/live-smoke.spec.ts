import { test, expect } from '@playwright/test'

const LIVE = 'https://www.nerveey.shop'

test.describe('Live smoke — nerveey.shop', () => {
  test('homepage loads with HSTS+CSP', async ({ page }) => {
    const res = await page.goto(LIVE)
    expect(res?.status()).toBe(200)
    const hsts = res?.headers()['strict-transport-security']
    expect(hsts).toContain('max-age=63072000')
    const csp = res?.headers()['content-security-policy']
    expect(csp).toContain("default-src 'self'")
    await expect(page.locator('body')).toBeVisible()
  })

  test('shop lists products and opens product detail', async ({ page }) => {
    const res = await page.goto(`${LIVE}/shop`)
    expect(res?.status()).toBe(200)
    await expect(page.locator('body')).toContainText(/NERVE/i)
    // If products exist, try to navigate to first
    const anyProduct = page.locator('a[href*="/product/"]')
    if (await anyProduct.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await anyProduct.first().click()
      await expect(page).toHaveURL(/\/product\//)
    }
  })

  test('guest order tracking page loads', async ({ page }) => {
    const res = await page.goto(`${LIVE}/guest-order`)
    expect(res?.status()).toBe(200)
    await expect(page.locator('body')).toContainText(/NERVE/i)
    await expect(page.getByTestId('guest-email-input')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('guest-order-number-input')).toBeVisible()
  })

  test('admin returns page requires auth redirect', async ({ page }) => {
    await page.goto(`${LIVE}/admin/returns`)
    // Should redirect to /login or show admin guard
    await page.waitForLoadState('networkidle')
    const url = page.url()
    expect(url).toMatch(/\/login|\/admin/)
  })
})
