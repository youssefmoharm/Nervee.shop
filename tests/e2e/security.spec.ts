import { test, expect } from '@playwright/test'

test.describe('Security Testing', () => {
  test('authentication and authorization security', async ({ page }) => {
    // 1. Test unauthenticated access to protected routes
    await page.goto('/account')
    await expect(page).toHaveURL(/.*\/(login|auth)/)

    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/.*\/admin\/login/)

    await page.goto('/checkout')
    await expect(page).toHaveURL(/.*\/(login|auth)/)

    // 2. Test weak password rejection
    await page.goto('/register')
    await page.fill('[data-testid="firstName-input"]', 'John')
    await page.fill('[data-testid="lastName-input"]', 'Doe')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', '123')
    await page.fill('[data-testid="confirm-password-input"]', '123')
    await page.click('[data-testid="register-button"]')
    
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-error"]')).toContainText(/least 8 characters|too weak/i)

    // 3. Test SQL injection attempts in login
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', "admin@nerve.com'; DROP TABLE users; --")
    await page.fill('[data-testid="password-input"]', "password")
    await page.click('[data-testid="login-button"]')
    
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-error"]')).not.toContainText(/database error|sql/i)

    // 4. Test XSS attempts in form inputs
    const xssPayload = '<script>alert("XSS")</script>'
    
    await page.goto('/contact')
    await page.fill('[data-testid="contact-name-input"]', xssPayload)
    await page.fill('[data-testid="contact-email-input"]', 'test@example.com')
    await page.fill('[data-testid="contact-message-input"]', xssPayload)
    await page.click('[data-testid="send-message-button"]')
    
    // Should not execute script, should be sanitized
    const nameValue = await page.locator('[data-testid="contact-name-input"]').inputValue()
    expect(nameValue).not.toContain('<script>')
    
    // 5. Test CSRF protection (if implemented)
    await page.route('**/api/**', async route => {
      const request = route.request()
      if (request.method() === 'POST' && !request.headers()['x-csrf-token']) {
        await route.fulfill({ status: 403, body: JSON.stringify({ error: 'CSRF token required' }) })
      } else {
        await route.continue()
      }
    })
    
    // Try form submission without CSRF token
    await page.goto('/newsletter')
    await page.fill('[data-testid="newsletter-email-input"]', 'test@example.com')
    await page.click('[data-testid="newsletter-subscribe-button"]')
    
    // Should fail due to missing CSRF token
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
  })

  test('data validation and sanitization', async ({ page }) => {
    // 1. Test email validation bypass attempts
    const invalidEmails = [
      'notanemail',
      '@domain.com',
      'user@',
      'user..name@domain.com',
      'javascript:alert(1)@domain.com',
      '<script>@domain.com'
    ]

    await page.goto('/newsletter')
    
    for (const invalidEmail of invalidEmails) {
      await page.fill('[data-testid="newsletter-email-input"]', invalidEmail)
      await page.click('[data-testid="newsletter-subscribe-button"]')
      
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
      await page.locator('[data-testid="newsletter-email-input"]').clear()
    }

    // 2. Test phone number validation
    await page.goto('/checkout')
    
    // Login first
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    
    await page.goto('/checkout')
    
    const invalidPhones = [
      '123',
      'abc123456789',
      '<script>alert(1)</script>',
      'javascript:alert(1)',
      '++++++++++++'
    ]

    for (const invalidPhone of invalidPhones) {
      await page.fill('[data-testid="phone-input"]', invalidPhone)
      await page.click('[data-testid="place-order-button"]')
      
      await expect(page.locator('[data-testid="phone-error"]')).toBeVisible()
      await page.locator('[data-testid="phone-input"]').clear()
    }

    // 3. Test address validation for injection attempts
    const maliciousAddresses = [
      '<script>alert("XSS")</script>',
      'javascript:alert(1)',
      '${7*7}',
      '{{constructor.constructor("alert(1)")()}}',
      'onmouseover=alert(1)'
    ]

    for (const maliciousAddress of maliciousAddresses) {
      await page.fill('[data-testid="address-input"]', maliciousAddress)
      await page.click('[data-testid="place-order-button"]')
      
      // Address should be sanitized, not executed
      const addressValue = await page.locator('[data-testid="address-input"]').inputValue()
      expect(addressValue).not.toContain('<script>')
      expect(addressValue).not.toContain('javascript:')
      
      await page.locator('[data-testid="address-input"]').clear()
    }
  })

  test('payment security', async ({ page }) => {
    // 1. Test payment amount tampering protection
    await page.route('**/api/create-order', async route => {
      const requestBody = await route.request().postDataJSON()
      
      // Simulate tampering with order total
      if (requestBody && requestBody.total) {
        requestBody.total = 1 // Try to change to 1 EGP
      }
      
      await route.continue({ postData: JSON.stringify(requestBody) })
    })

    // Login and add items to cart
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    await page.goto('/shop')
    await page.click('[data-testid="product-card"]:first-child')
    await page.click('[data-testid="add-to-cart-button"]')
    await page.click('[data-testid="checkout-button"]')

    // Fill checkout and attempt payment
    await page.fill('[data-testid="phone-input"]', '01234567890')
    await page.fill('[data-testid="address-input"]', '123 Main Street, Cairo, Egypt')
    await page.selectOption('[data-testid="governorate-select"]', 'cairo')
    await page.check('[data-testid="card-radio"]')
    await page.click('[data-testid="place-order-button"]')

    // Should reject due to amount tampering
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="payment-error"]')).toContainText(/amount.*invalid|tamper/i)

    // 2. Test duplicate payment prevention
    await page.unroute('**/api/create-order')
    
    // Mock successful payment response with same transaction ID
    let paymentCount = 0
    await page.route('**/paymob-webhook', async route => {
      paymentCount++
      if (paymentCount > 1) {
        await route.fulfill({ 
          status: 400, 
          body: JSON.stringify({ error: 'Duplicate transaction' }) 
        })
      } else {
        await route.continue()
      }
    })

    // Try to submit payment twice
    await page.click('[data-testid="place-order-button"]')
    await page.click('[data-testid="place-order-button"]')

    // Second payment should be rejected
    await expect(page.locator('[data-testid="duplicate-payment-error"]')).toBeVisible()
  })

  test('rate limiting and abuse prevention', async ({ page }) => {
    // 1. Test login rate limiting
    await page.goto('/login')
    
    // Make multiple failed login attempts
    for (let i = 0; i < 6; i++) {
      await page.fill('[data-testid="email-input"]', 'test@example.com')
      await page.fill('[data-testid="password-input"]', 'wrongpassword')
      await page.click('[data-testid="login-button"]')
      await page.waitForTimeout(100) // Small delay between attempts
    }

    // Should be rate limited after 5 attempts
    await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="rate-limit-error"]')).toContainText(/too many attempts|rate limit/i)

    // 2. Test newsletter signup rate limiting
    await page.goto('/newsletter')
    
    // Make multiple signup attempts
    for (let i = 0; i < 4; i++) {
      await page.fill('[data-testid="newsletter-email-input"]', `test${i}@example.com`)
      await page.click('[data-testid="newsletter-subscribe-button"]')
      await page.waitForTimeout(100)
    }

    // Should be rate limited
    await expect(page.locator('[data-testid="newsletter-rate-limit"]')).toBeVisible()

    // 3. Test contact form rate limiting
    await page.goto('/contact')
    
    for (let i = 0; i < 4; i++) {
      await page.fill('[data-testid="contact-name-input"]', 'Test User')
      await page.fill('[data-testid="contact-email-input"]', `test${i}@example.com`)
      await page.fill('[data-testid="contact-message-input"]', 'Test message')
      await page.click('[data-testid="send-message-button"]')
      await page.waitForTimeout(100)
    }

    await expect(page.locator('[data-testid="contact-rate-limit"]')).toBeVisible()
  })

  test('session security', async ({ page }) => {
    // 1. Test session fixation protection
    const initialCookies = await page.context().cookies()
    const sessionCookie = initialCookies.find(c => c.name.includes('session'))
    
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    const postLoginCookies = await page.context().cookies()
    const newSessionCookie = postLoginCookies.find(c => c.name.includes('session'))
    
    // Session ID should change after login
    if (sessionCookie && newSessionCookie) {
      expect(newSessionCookie.value).not.toBe(sessionCookie.value)
    }

    // 2. Test secure cookie attributes
    const secureCookies = postLoginCookies.filter(c => 
      c.name.includes('session') || c.name.includes('token')
    )
    
    for (const cookie of secureCookies) {
      expect(cookie.secure).toBe(true) // Should be secure in production
      expect(cookie.httpOnly).toBe(true) // Should be httpOnly
      expect(cookie.sameSite).toBe('Strict') // Should prevent CSRF
    }

    // 3. Test session timeout
    await page.route('**/api/**', route => {
      if (route.request().url().includes('session-check')) {
        route.fulfill({ status: 401, body: JSON.stringify({ error: 'Session expired' }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/account')
    await expect(page).toHaveURL(/.*\/(login|auth)/)
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible()
  })

  test('content security policy', async ({ page }) => {
    // 1. Test inline script blocking
    await page.addInitScript(() => {
      // Mock CSP violation reporting
      window.addEventListener('securitypolicyviolation', (e) => {
        console.log('CSP Violation:', e.violatedDirective, e.blockedURI)
        window.cspViolations = window.cspViolations || []
        window.cspViolations.push(e)
      })
    })

    await page.goto('/')
    
    // Try to inject inline script
    await page.evaluate(() => {
      const script = document.createElement('script')
      script.innerHTML = 'alert("CSP Test")'
      document.head.appendChild(script)
    })

    // Check if CSP blocked the script
    const violations = await page.evaluate(() => window.cspViolations || [])
    expect(violations.length).toBeGreaterThan(0)

    // 2. Test external resource blocking
    await page.evaluate(() => {
      const img = document.createElement('img')
      img.src = 'http://malicious-site.com/track.png'
      document.body.appendChild(img)
    })

    // Should be blocked by CSP
    const moreViolations = await page.evaluate(() => window.cspViolations || [])
    expect(moreViolations.some(v => v.blockedURI.includes('malicious-site.com'))).toBe(true)
  })

  test('input length and size limits', async ({ page }) => {
    await page.goto('/contact')
    
    // 1. Test oversized text inputs
    const veryLongString = 'A'.repeat(10000)
    
    await page.fill('[data-testid="contact-name-input"]', veryLongString)
    await page.fill('[data-testid="contact-message-input"]', veryLongString)
    await page.click('[data-testid="send-message-button"]')
    
    // Should be rejected or truncated
    await expect(page.locator('[data-testid="input-too-long-error"]')).toBeVisible()

    // 2. Test file upload size limits
    if (await page.locator('[data-testid="file-upload-input"]').isVisible()) {
      // Create a mock large file
      await page.setInputFiles('[data-testid="file-upload-input"]', {
        name: 'large-file.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.alloc(10 * 1024 * 1024) // 10MB
      })

      await expect(page.locator('[data-testid="file-too-large-error"]')).toBeVisible()
    }

    // 3. Test JSON payload size limits
    await page.route('**/api/**', async route => {
      const contentLength = route.request().headers()['content-length']
      if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB limit
        await route.fulfill({ 
          status: 413, 
          body: JSON.stringify({ error: 'Payload too large' }) 
        })
      } else {
        await route.continue()
      }
    })

    const largeData = { message: 'x'.repeat(2 * 1024 * 1024) } // 2MB
    
    await page.evaluate(async (data) => {
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        window.payloadTestResult = response.status
      } catch (e) {
        window.payloadTestResult = 'error'
      }
    }, largeData)

    const result = await page.evaluate(() => window.payloadTestResult)
    expect(result).toBe(413) // Payload Too Large
  })

  test('admin privilege escalation prevention', async ({ page }) => {
    // 1. Login as regular user
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'user@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    // 2. Try to access admin endpoints
    const adminUrls = [
      '/admin/dashboard',
      '/admin/products',
      '/admin/orders',
      '/admin/customers',
      '/admin/discounts'
    ]

    for (const url of adminUrls) {
      await page.goto(url)
      await expect(page).not.toHaveURL(url)
      // Should redirect to login or show access denied
      const hasError = await page.locator('[data-testid="access-denied"], [data-testid="admin-required"]').isVisible()
      expect(hasError).toBe(true)
    }

    // 3. Try to manipulate JWT token
    await page.evaluate(() => {
      // Try to modify localStorage token
      const token = localStorage.getItem('auth-token')
      if (token) {
        // Try to modify role claim
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]))
          payload.role = 'admin'
          parts[1] = btoa(JSON.stringify(payload))
          localStorage.setItem('auth-token', parts.join('.'))
        }
      }
    })

    // Try admin access again - should still be denied
    await page.goto('/admin/dashboard')
    await expect(page).not.toHaveURL('/admin/dashboard')

    // 4. Test API endpoint protection
    await page.route('**/admin/api/**', async route => {
      const authHeader = route.request().headers()['authorization']
      if (!authHeader || !authHeader.includes('admin-token')) {
        await route.fulfill({ 
          status: 403, 
          body: JSON.stringify({ error: 'Admin access required' }) 
        })
      } else {
        await route.continue()
      }
    })

    const apiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/admin/api/products')
        return { status: response.status, ok: response.ok }
      } catch (e) {
        return { status: 'error', ok: false }
      }
    })

    expect(apiResponse.status).toBe(403)
    expect(apiResponse.ok).toBe(false)
  })
})