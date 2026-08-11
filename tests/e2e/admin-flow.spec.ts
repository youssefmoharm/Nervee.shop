import { test, expect } from '@playwright/test'

test.describe('Admin Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Admin login before each test
    await page.goto('/admin/login')
    await page.fill('[data-testid="admin-email-input"]', 'admin@nerve.com')
    await page.fill('[data-testid="admin-password-input"]', 'admin123')
    await page.click('[data-testid="admin-login-button"]')
    await expect(page).toHaveURL(/.*\/admin\/dashboard/)
  })

  test('admin dashboard overview', async ({ page }) => {
    // 1. Verify dashboard elements
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-orders-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-revenue-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-customers-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="low-stock-alert"]')).toBeVisible()

    // 2. Verify navigation menu
    await expect(page.locator('[data-testid="admin-nav-products"]')).toBeVisible()
    await expect(page.locator('[data-testid="admin-nav-orders"]')).toBeVisible()
    await expect(page.locator('[data-testid="admin-nav-customers"]')).toBeVisible()
    await expect(page.locator('[data-testid="admin-nav-discounts"]')).toBeVisible()

    // 3. Test dashboard metrics are numbers
    const totalOrders = await page.locator('[data-testid="total-orders-value"]').textContent()
    const totalRevenue = await page.locator('[data-testid="total-revenue-value"]').textContent()
    
    expect(totalOrders).toMatch(/^\d+$/)
    expect(totalRevenue).toMatch(/^\d+(\.\d{2})? EGP$/)
  })

  test('product management workflow', async ({ page }) => {
    // 1. Navigate to products
    await page.click('[data-testid="admin-nav-products"]')
    await expect(page.locator('[data-testid="products-table"]')).toBeVisible()

    // 2. Add new product
    await page.click('[data-testid="add-product-button"]')
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible()

    // Fill product details
    await page.fill('[data-testid="product-name-input"]', 'Test Admin Product')
    await page.fill('[data-testid="product-description-input"]', 'Test product description')
    await page.fill('[data-testid="product-price-input"]', '299.99')
    await page.selectOption('[data-testid="product-category-select"]', 'T-Shirts')
    await page.fill('[data-testid="product-material-input"]', '100% Cotton')

    // Add colors and sizes
    await page.click('[data-testid="add-color-button"]')
    await page.fill('[data-testid="color-name-input-0"]', 'Black')
    await page.fill('[data-testid="color-hex-input-0"]', '#000000')
    
    await page.check('[data-testid="size-xs-checkbox"]')
    await page.check('[data-testid="size-m-checkbox"]')
    await page.check('[data-testid="size-l-checkbox"]')

    // Upload product images (mock)
    await page.setInputFiles('[data-testid="product-images-input"]', [
      'tests/fixtures/product-image-1.jpg',
      'tests/fixtures/product-image-2.jpg'
    ])

    // Save product
    await page.click('[data-testid="save-product-button"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()

    // 3. Verify product appears in list
    await expect(page.locator('[data-testid="products-table"]')).toContainText('Test Admin Product')

    // 4. Edit existing product
    await page.click('[data-testid="edit-product-button"]:has-text("Test Admin Product")')
    await page.fill('[data-testid="product-price-input"]', '349.99')
    await page.click('[data-testid="save-product-button"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()

    // 5. Update inventory
    await page.click('[data-testid="inventory-button"]:has-text("Test Admin Product")')
    await page.fill('[data-testid="stock-xs-input"]', '50')
    await page.fill('[data-testid="stock-m-input"]', '75')
    await page.fill('[data-testid="stock-l-input"]', '100')
    await page.click('[data-testid="update-inventory-button"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()

    // 6. Deactivate product
    await page.click('[data-testid="toggle-product-status"]:has-text("Test Admin Product")')
    await expect(page.locator('[data-testid="product-status-inactive"]')).toBeVisible()

    // 7. Delete product (with confirmation)
    await page.click('[data-testid="delete-product-button"]:has-text("Test Admin Product")')
    await expect(page.locator('[data-testid="delete-confirmation-modal"]')).toBeVisible()
    await page.fill('[data-testid="delete-confirmation-input"]', 'DELETE')
    await page.click('[data-testid="confirm-delete-button"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()
    await expect(page.locator('[data-testid="products-table"]')).not.toContainText('Test Admin Product')
  })

  test('order management workflow', async ({ page }) => {
    // 1. Navigate to orders
    await page.click('[data-testid="admin-nav-orders"]')
    await expect(page.locator('[data-testid="orders-table"]')).toBeVisible()

    // 2. Filter orders by status
    await page.selectOption('[data-testid="order-status-filter"]', 'pending')
    await expect(page.locator('[data-testid="orders-table"] tbody tr')).toHaveCount.greaterThan(0)

    // 3. View order details
    await page.click('[data-testid="view-order-button"]:first-child')
    await expect(page.locator('[data-testid="order-details-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="order-customer-info"]')).toBeVisible()
    await expect(page.locator('[data-testid="order-items-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="order-payment-info"]')).toBeVisible()

    // 4. Update order status
    await page.selectOption('[data-testid="order-status-update"]', 'processing')
    await page.click('[data-testid="update-order-status-button"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()
    
    // 5. Add order notes
    await page.fill('[data-testid="order-notes-input"]', 'Customer requested express shipping')
    await page.click('[data-testid="add-order-note-button"]')
    await expect(page.locator('[data-testid="order-notes-list"]')).toContainText('express shipping')

    // 6. Print invoice
    await page.click('[data-testid="print-invoice-button"]')
    // Verify download or print dialog (implementation dependent)
    
    // 7. Close order details
    await page.click('[data-testid="close-order-details"]')
    await expect(page.locator('[data-testid="order-details-modal"]')).not.toBeVisible()

    // 8. Bulk status update
    await page.check('[data-testid="select-order-checkbox"]:nth-child(1)')
    await page.check('[data-testid="select-order-checkbox"]:nth-child(2)')
    await page.selectOption('[data-testid="bulk-status-select"]', 'shipped')
    await page.click('[data-testid="bulk-update-button"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()
  })

  test('customer management workflow', async ({ page }) => {
    // 1. Navigate to customers
    await page.click('[data-testid="admin-nav-customers"]')
    await expect(page.locator('[data-testid="customers-table"]')).toBeVisible()

    // 2. Search customers
    await page.fill('[data-testid="customer-search-input"]', 'john@example.com')
    await page.press('[data-testid="customer-search-input"]', 'Enter')
    await expect(page.locator('[data-testid="customers-table"]')).toContainText('john@example.com')

    // 3. View customer profile
    await page.click('[data-testid="view-customer-button"]:first-child')
    await expect(page.locator('[data-testid="customer-profile-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="customer-basic-info"]')).toBeVisible()
    await expect(page.locator('[data-testid="customer-order-history"]')).toBeVisible()
    await expect(page.locator('[data-testid="customer-addresses"]')).toBeVisible()

    // 4. View customer's order history
    await expect(page.locator('[data-testid="customer-orders-list"] tr')).toHaveCount.greaterThan(0)
    const totalSpent = await page.locator('[data-testid="customer-total-spent"]').textContent()
    expect(totalSpent).toMatch(/^\d+(\.\d{2})? EGP$/)

    // 5. Export customer data (GDPR compliance)
    await page.click('[data-testid="export-customer-data-button"]')
    await expect(page.locator('[data-testid="success-notification"]')).toContainText('export')

    // 6. Customer communication
    await page.fill('[data-testid="customer-message-input"]', 'Hello! Your order has been processed.')
    await page.click('[data-testid="send-message-button"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()

    // 7. Close customer profile
    await page.click('[data-testid="close-customer-profile"]')
    await expect(page.locator('[data-testid="customer-profile-modal"]')).not.toBeVisible()
  })

  test('discount codes management workflow', async ({ page }) => {
    // 1. Navigate to discounts
    await page.click('[data-testid="admin-nav-discounts"]')
    await expect(page.locator('[data-testid="discounts-table"]')).toBeVisible()

    // 2. Create percentage discount
    await page.click('[data-testid="create-discount-button"]')
    await page.fill('[data-testid="discount-code-input"]', 'TESTADMIN10')
    await page.selectOption('[data-testid="discount-type-select"]', 'percentage')
    await page.fill('[data-testid="discount-value-input"]', '10')
    await page.fill('[data-testid="minimum-amount-input"]', '200')
    await page.fill('[data-testid="usage-limit-input"]', '100')
    await page.fill('[data-testid="valid-from-input"]', '2024-01-01')
    await page.fill('[data-testid="valid-until-input"]', '2024-12-31')
    await page.click('[data-testid="save-discount-button"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()

    // 3. Create fixed amount discount
    await page.click('[data-testid="create-discount-button"]')
    await page.fill('[data-testid="discount-code-input"]', 'SAVE50EGP')
    await page.selectOption('[data-testid="discount-type-select"]', 'fixed')
    await page.fill('[data-testid="discount-value-input"]', '50')
    await page.fill('[data-testid="minimum-amount-input"]', '500')
    await page.fill('[data-testid="usage-limit-input"]', '50')
    await page.click('[data-testid="save-discount-button"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()

    // 4. Test discount code
    await page.click('[data-testid="test-discount-button"]:has-text("TESTADMIN10")')
    await page.fill('[data-testid="test-order-amount"]', '250')
    await page.click('[data-testid="calculate-discount"]')
    await expect(page.locator('[data-testid="discount-result"]')).toContainText('225.00 EGP')

    // 5. View discount usage analytics
    await page.click('[data-testid="view-analytics-button"]:has-text("TESTADMIN10")')
    await expect(page.locator('[data-testid="discount-analytics-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible()
    await expect(page.locator('[data-testid="usage-stats"]')).toBeVisible()

    // 6. Deactivate discount
    await page.click('[data-testid="close-analytics"]')
    await page.click('[data-testid="toggle-discount-status"]:has-text("TESTADMIN10")')
    await expect(page.locator('[data-testid="discount-status-inactive"]')).toBeVisible()

    // 7. Delete discount
    await page.click('[data-testid="delete-discount-button"]:has-text("SAVE50EGP")')
    await expect(page.locator('[data-testid="delete-confirmation-modal"]')).toBeVisible()
    await page.click('[data-testid="confirm-delete-discount"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()
  })

  test('analytics and reports', async ({ page }) => {
    // 1. Navigate to dashboard analytics
    await page.click('[data-testid="admin-nav-dashboard"]')
    await expect(page.locator('[data-testid="analytics-section"]')).toBeVisible()

    // 2. Test date range picker
    await page.click('[data-testid="date-range-picker"]')
    await page.click('[data-testid="last-7-days"]')
    await expect(page.locator('[data-testid="sales-chart"]')).toBeVisible()

    // 3. Export sales report
    await page.click('[data-testid="export-sales-report"]')
    await page.selectOption('[data-testid="report-format-select"]', 'csv')
    await page.click('[data-testid="download-report"]')
    // Verify download initiated

    // 4. View top selling products
    await page.click('[data-testid="top-products-tab"]')
    await expect(page.locator('[data-testid="top-products-chart"]')).toBeVisible()
    await expect(page.locator('[data-testid="product-performance-table"]')).toBeVisible()

    // 5. Customer acquisition metrics
    await page.click('[data-testid="customer-metrics-tab"]')
    await expect(page.locator('[data-testid="new-customers-chart"]')).toBeVisible()
    await expect(page.locator('[data-testid="customer-retention-rate"]')).toBeVisible()

    // 6. Inventory alerts
    await page.click('[data-testid="inventory-alerts-tab"]')
    await expect(page.locator('[data-testid="low-stock-products"]')).toBeVisible()
    await expect(page.locator('[data-testid="out-of-stock-products"]')).toBeVisible()

    // Handle low stock alert
    if (await page.locator('[data-testid="restock-alert"]:first-child').isVisible()) {
      await page.click('[data-testid="quick-restock-button"]:first-child')
      await page.fill('[data-testid="restock-quantity"]', '50')
      await page.click('[data-testid="confirm-restock"]')
      await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()
    }
  })

  test('admin settings and configuration', async ({ page }) => {
    // 1. Navigate to settings (if available)
    await page.click('[data-testid="admin-nav-settings"]')
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible()

    // 2. Update store settings
    await page.fill('[data-testid="store-name-input"]', 'NERVE Concept Store Updated')
    await page.fill('[data-testid="store-email-input"]', 'admin@nerve-updated.com')
    await page.fill('[data-testid="store-phone-input"]', '+201234567890')
    await page.click('[data-testid="save-store-settings"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()

    // 3. Update shipping settings
    await page.click('[data-testid="shipping-settings-tab"]')
    await page.fill('[data-testid="cairo-shipping-fee"]', '45')
    await page.fill('[data-testid="giza-shipping-fee"]', '50')
    await page.fill('[data-testid="free-shipping-threshold"]', '1000')
    await page.click('[data-testid="save-shipping-settings"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()

    // 4. Update tax settings
    await page.click('[data-testid="tax-settings-tab"]')
    await page.fill('[data-testid="tax-rate-input"]', '14')
    await page.check('[data-testid="tax-included-checkbox"]')
    await page.click('[data-testid="save-tax-settings"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()

    // 5. Payment gateway settings
    await page.click('[data-testid="payment-settings-tab"]')
    await expect(page.locator('[data-testid="paymob-settings"]')).toBeVisible()
    // Note: Don't actually change payment settings in tests
    await expect(page.locator('[data-testid="paymob-test-mode"]')).toBeChecked()

    // 6. Email notification settings
    await page.click('[data-testid="notifications-settings-tab"]')
    await page.check('[data-testid="order-confirmation-emails"]')
    await page.check('[data-testid="low-stock-alerts"]')
    await page.uncheck('[data-testid="marketing-emails"]')
    await page.click('[data-testid="save-notification-settings"]')
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible()
  })

  test('admin security and access control', async ({ page }) => {
    // 1. Test admin session timeout (mock)
    await page.route('**/admin/api/**', route => {
      if (route.request().url().includes('session-check')) {
        route.fulfill({ status: 401, body: JSON.stringify({ error: 'Session expired' }) })
      } else {
        route.continue()
      }
    })

    await page.reload()
    await expect(page).toHaveURL(/.*\/admin\/login/)
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible()

    // 2. Re-login and test activity logging
    await page.fill('[data-testid="admin-email-input"]', 'admin@nerve.com')
    await page.fill('[data-testid="admin-password-input"]', 'admin123')
    await page.click('[data-testid="admin-login-button"]')

    // 3. Check admin activity log
    await page.click('[data-testid="admin-nav-activity-log"]')
    await expect(page.locator('[data-testid="activity-log-table"]')).toBeVisible()
    
    // Verify recent login is logged
    await expect(page.locator('[data-testid="activity-log-table"]')).toContainText('Admin login')
    await expect(page.locator('[data-testid="activity-log-table"]')).toContainText('admin@nerve.com')

    // 4. Test unauthorized actions (should be blocked)
    await page.route('**/admin/api/users/**', route => {
      route.fulfill({ status: 403, body: JSON.stringify({ error: 'Forbidden' }) })
    })

    if (await page.locator('[data-testid="admin-nav-users"]').isVisible()) {
      await page.click('[data-testid="admin-nav-users"]')
      await expect(page.locator('[data-testid="access-denied-message"]')).toBeVisible()
    }
  })

  test('admin logout and session cleanup', async ({ page }) => {
    // 1. Verify admin is logged in
    await expect(page.locator('[data-testid="admin-user-menu"]')).toBeVisible()

    // 2. Logout
    await page.click('[data-testid="admin-user-menu"]')
    await page.click('[data-testid="admin-logout-button"]')

    // 3. Verify redirect to login
    await expect(page).toHaveURL(/.*\/admin\/login/)
    await expect(page.locator('[data-testid="logout-success-message"]')).toBeVisible()

    // 4. Verify session is cleared (try to access admin page)
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/.*\/admin\/login/)

    // 5. Verify no cached admin data
    const cookies = await page.context().cookies()
    const adminTokenCookie = cookies.find(cookie => cookie.name.includes('admin-token'))
    expect(adminTokenCookie).toBeFalsy()
  })
})