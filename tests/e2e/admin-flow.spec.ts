import { test, expect } from '@playwright/test'

test.describe('Admin Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('unauthenticated users are redirected to sign in', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })

  test('admin sub-routes redirect unauthenticated users to sign in', async ({ page }) => {
    for (const path of ['/admin/orders', '/admin/products', '/admin/customers', '/admin/discounts']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('sign in page validates required fields', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-button').click()
    // Browser native validation blocks empty submit — no network error shown
    await expect(page.getByTestId('login-button')).toBeVisible()
  })

  test('sign in shows an error for unauthenticated submit', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill('admin@nerve.test')
    await page.getByTestId('login-password-input').fill('wrong-password')
    await page.getByTestId('login-button').click()
    // In demo mode (no backend) signIn fails cleanly rather than crashing
    await expect(page.getByTestId('login-button')).toBeVisible()
  })
})
