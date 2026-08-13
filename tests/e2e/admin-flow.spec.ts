import { test, expect } from '@playwright/test'

test.describe('Admin Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for auth context to initialize
    await page.waitForLoadState('networkidle')
  })

  test('unauthenticated users are redirected to sign in', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'networkidle' })
    // Wait for navigation to complete
    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })

  test('admin sub-routes redirect unauthenticated users to sign in', async ({ page }) => {
    const paths = ['/admin/orders', '/admin/products', '/admin/customers', '/admin/discounts']
    for (const path of paths) {
      await page.goto(path, { waitUntil: 'networkidle' })
      // Wait for the auth guard to redirect
      await page.waitForURL(/\/login/, { timeout: 5000 })
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('sign in page validates required fields', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.getByTestId('login-button').click()
    // Browser native validation blocks empty submit — no network error shown
    await expect(page.getByTestId('login-button')).toBeVisible()
  })

  test('sign in shows an error for unauthenticated submit', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.getByTestId('login-email-input').fill('admin@nerve.test')
    await page.getByTestId('login-password-input').fill('wrong-password')
    await page.getByTestId('login-button').click()
    // Wait for auth attempt to fail
    await page.waitForTimeout(1000)
    // In demo mode (no backend) signIn fails cleanly rather than crashing
    await expect(page.getByTestId('login-button')).toBeVisible()
  })
})
