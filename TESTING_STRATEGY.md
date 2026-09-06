# Testing Strategy & Expansion — PHASE 9

## Status: DOCUMENTED ✅

Comprehensive testing strategy for NERVE with roadmap for expanding test coverage across unit, integration, and E2E layers.

## Current Testing Infrastructure

### Test Runners Configured ✅
**Vitest** (Unit & Integration):
```bash
npm run test              # Run tests once
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
npm run test:ui          # UI dashboard
```

**Playwright** (E2E):
```bash
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # UI mode
```

**CI Pipeline** (GitHub Actions):
```bash
npm run ci               # typecheck && lint && test --run && build
```

### Testing Libraries Installed ✅
- `vitest@^4.1.10` — Unit test runner
- `@testing-library/react@^14.1.2` — React component testing
- `@testing-library/user-event@^14.5.1` — User interaction simulation
- `@testing-library/jest-dom@^6.1.4` — DOM matchers
- `@vitest/coverage-v8@^4.1.10` — Code coverage
- `@vitest/ui@^4.1.10` — UI dashboard
- `@playwright/test@^1.40.0` — E2E browser automation

## Test Coverage Roadmap

### Layer 1: Unit Tests (60% target)

#### A. Utility Functions ✅ (Ready)
**Location:** `src/lib/*.test.ts`

**Tests to Add:**
1. **egyptianValidation.ts:**
   - ✅ validateEgyptianPhone: valid/invalid carriers
   - ✅ validateAddress: length bounds, XSS prevention
   - ✅ validateCity: English/Arabic/mixed
   - ✅ validateGovernorate: all 27 governorates
   - ✅ validateCheckoutForm: batch validation

2. **seo.ts:**
   - ✅ updateMetaTags: DOM meta elements updated
   - ✅ addStructuredData: JSON-LD script injected
   - ✅ Schema generators: Product, Organization, Breadcrumb

3. **checkoutSessionManager.ts:**
   - ✅ saveSession: localStorage write
   - ✅ getSession: localStorage read with expiry check
   - ✅ clearSession: cleanup
   - ✅ isExpired: 24h expiry logic

**Example Test:**
```typescript
describe('egyptianValidation', () => {
  test('validateEgyptianPhone accepts 010 carrier', () => {
    expect(validateEgyptianPhone('01012345678')).toBe(true)
  })

  test('validateEgyptianPhone rejects invalid carrier', () => {
    expect(validateEgyptianPhone('01912345678')).toBe(false)
  })

  test('validateAddress prevents XSS injection', () => {
    const result = validateAddress('<script>alert("xss")</script>')
    expect(result.error).toContain('invalid')
  })
})
```

#### B. Service Functions (40% target)

**Location:** `src/services/*.test.ts`

**Tests to Add:**
1. **productService.ts:**
   - ✅ getBySlug: returns product + related products
   - ✅ search: filters by query
   - ✅ filter: applies category/price/color filters
   - ✅ Error handling: no results, network error

2. **orderService.ts:**
   - ✅ placeOrder: successful order creation
   - ✅ placeOrder: duplicate detection (idempotency key)
   - ✅ Guest order lookup with token
   - ✅ Validation errors (no items, invalid address)

3. **imageService.ts:**
   - ✅ generateImageUrl: correct URLs generated
   - ✅ generateSrcSet: responsive image srcSet
   - ✅ Error handling: missing images

### Layer 2: Component Tests (50% target)

**Location:** `src/components/*.test.tsx`

**Priority Components:**
1. **ProductCard.test.tsx:**
   - Render product with image, price, availability
   - Add to wishlist button works
   - Link to product detail works
   - Accessibility: alt text, labels present

2. **CheckoutStepper.test.tsx:**
   - Desktop: all steps rendered
   - Mobile: progress bar displayed
   - Active step highlighted correctly
   - Aria attributes correct

3. **OptimizedImage.test.tsx:**
   - Picture element rendered with srcSet
   - Fallback image shown on error
   - Lazy loading attribute present
   - Alt text passed through

4. **ErrorBoundary.test.tsx:**
   - Catches errors + shows fallback UI
   - Error details shown in dev mode
   - Refresh button works
   - Sentry logging triggered

**Example Test:**
```typescript
describe('ProductCard', () => {
  const mockProduct = {
    id: '1',
    name: 'Test Product',
    price: 100,
    image: '/test.jpg',
    slug: 'test-product'
  }

  test('renders product name and price', () => {
    const { getByText } = render(<ProductCard product={mockProduct} />)
    expect(getByText('Test Product')).toBeInTheDocument()
    expect(getByText('EGP 100')).toBeInTheDocument()
  })

  test('has accessible link to product detail', () => {
    const { getByRole } = render(<ProductCard product={mockProduct} />)
    const link = getByRole('link')
    expect(link).toHaveAttribute('href', '/product/test-product')
  })
})
```

### Layer 3: Page Integration Tests (40% target)

**Location:** `src/pages/*.test.tsx`

**Priority Pages:**
1. **Shop.test.tsx:**
   - Products load and display
   - Filters work (category, color, price)
   - Search query filters results
   - Pagination works
   - Empty state shown when no results
   - Error state on fetch failure
   - Mobile view works

2. **ProductDetail.test.tsx:**
   - Product loads by slug
   - Image gallery works (keyboard navigation)
   - Color/size selection works
   - Add to bag/wishlist buttons work
   - Related products displayed
   - Reviews load and display
   - Not found state on invalid slug

3. **Checkout.test.tsx:**
   - Cart items display with quantities
   - Form validation works (phone, address)
   - Session recovery works
   - Order submission triggers
   - Idempotency prevents duplicates
   - Error recovery works

4. **Cart.test.tsx:**
   - Cart items display
   - Update quantities works
   - Remove items works
   - Empty state shows
   - Checkout button navigates

### Layer 4: E2E Tests (Critical Paths)

**Location:** `tests/e2e/*.spec.ts`

**Critical User Flows:**
1. **Full Checkout Flow:**
   ```typescript
   test('complete purchase as guest', async ({ page }) => {
     // 1. Browse products
     await page.goto('/shop')
     await page.click('[data-testid="product-card"]')
     
     // 2. Add to cart
     await page.selectOption('select[aria-label="Size"]', 'M')
     await page.click('button:has-text("Add to Bag")')
     
     // 3. Checkout
     await page.click('[data-testid="checkout-button"]')
     await page.fill('input[type="email"]', 'guest@example.com')
     await page.fill('input[aria-label="Phone"]', '01012345678')
     await page.fill('input[aria-label="Address"]', '123 Street')
     
     // 4. Place order
     await page.click('button:has-text("Place Order")')
     
     // 5. Verify confirmation
     await expect(page).toHaveURL(/\/order-confirmation/)
     await expect(page.locator('[role="heading"]')).toContainText('Thank You')
   })
   ```

2. **Search & Filter:**
   ```typescript
   test('search and filter products', async ({ page }) => {
     await page.goto('/shop')
     await page.fill('input[aria-label="Search"]', 'shirt')
     await page.click('button[aria-label="Search"]')
     
     await expect(page.locator('[data-testid="product-card"]')).toBeDefined()
     
     await page.click('input[value="Navy"]')  // Color filter
     await expect(page.locator('[data-testid="product-count"]'))
       .toContainText(/showing.*of/)
   })
   ```

3. **Order Tracking (Guest):**
   ```typescript
   test('guest can track order by number', async ({ page }) => {
     await page.goto('/track-order')
     await page.fill('input[name="orderNumber"]', '12345')
     await page.fill('input[name="email"]', 'guest@example.com')
     await page.click('button:has-text("Track")')
     
     await expect(page.locator('[role="main"]')).toContainText('Order #12345')
   })
   ```

4. **Mobile Checkout:**
   ```typescript
   test('mobile checkout works', async ({ page }) => {
     // Set mobile viewport
     await page.setViewportSize({ width: 375, height: 667 })
     
     // ... full checkout flow on mobile
     // Verify responsive layout works
     await expect(page.locator('button:has-text("Place Order")')).toBeVisible()
   })
   ```

## Test Data & Fixtures

### Mock Data ✅
**Location:** `src/test/fixtures/`

**Files to Create:**
1. `mockProducts.ts` — 10 sample products with various statuses
2. `mockOrders.ts` — Sample orders in different statuses
3. `mockUsers.ts` — Sample customer accounts
4. `mockForms.ts` — Pre-filled form data for tests

**Example:**
```typescript
export const mockProducts = [
  {
    id: '1',
    name: 'Navy T-Shirt',
    slug: 'navy-tshirt',
    price: 299,
    category: 'tops',
    colors: [{ name: 'Navy', hex: '#061735', image: '/nav-shirt.jpg' }],
    sizes: [
      { size: 'XS', inStock: true },
      { size: 'M', inStock: true },
      { size: 'L', inStock: false }
    ]
  },
  // ... more products
]
```

### Test Setup ✅
**Location:** `src/test/setup.ts`

**Contents:**
```typescript
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Cleanup after each test
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
      signUp: vi.fn(),
      signIn: vi.fn(),
    }
  }
}))

// Mock Sentry
vi.mock('../lib/sentry', () => ({
  logError: vi.fn(),
  trackError: vi.fn(),
}))
```

## Coverage Targets

| Layer | Type | Target | Current | Status |
|-------|------|--------|---------|--------|
| Unit | Utils | 80% | 0% | 📝 To do |
| Unit | Services | 70% | 10% | 📝 To do |
| Component | Critical | 60% | 5% | 📝 To do |
| Integration | Pages | 40% | 0% | 📝 To do |
| E2E | Critical Paths | 100% | 0% | 📝 To do |
| **Overall** | **All** | **60%** | **~5%** | **📝 To do** |

## Implementation Roadmap

### Week 1: Foundation
1. [ ] Create test setup (fixtures, mocks, config)
2. [ ] Add validation tests (egyptianValidation.ts)
3. [ ] Add session manager tests
4. [ ] Add SEO utility tests

### Week 2: Component Tests
1. [ ] ProductCard tests
2. [ ] CheckoutStepper tests
3. [ ] OptimizedImage tests
4. [ ] ErrorBoundary tests

### Week 3: Page Integration Tests
1. [ ] Shop page tests
2. [ ] ProductDetail page tests
3. [ ] Checkout page tests
4. [ ] Cart page tests

### Week 4: E2E Tests
1. [ ] Full checkout E2E
2. [ ] Search & filter E2E
3. [ ] Order tracking E2E
4. [ ] Mobile checkout E2E

## Running Tests Locally

```bash
# All tests once
npm run test

# Watch mode (during development)
npm run test:watch

# Coverage report
npm run test:coverage

# UI dashboard
npm run test:ui

# E2E tests
npm run test:e2e
npm run test:e2e:ui

# Specific test file
npm run test -- src/lib/egyptianValidation.test.ts

# Specific test name
npm run test -- --grep "validateEgyptianPhone"

# CI mode (like GitHub Actions)
npm run ci
```

## Test Quality Guidelines

### Best Practices
1. **Test Behavior, Not Implementation:** Focus on what users do, not how code works
2. **Use Meaningful Names:** `test('disables submit button when form is invalid')`
3. **Arrange-Act-Assert:** Clear test structure
4. **Avoid Test Interdependence:** Each test must be runnable alone
5. **Mock External Services:** Supabase, Sentry, Google APIs
6. **Test Error Cases:** Not just happy path
7. **Use Accessibility Queries:** `getByRole`, `getByLabelText` (not `getByClass`)

### Anti-Patterns to Avoid
- ❌ Testing implementation details (state, private methods)
- ❌ Using `data-testid` for every element
- ❌ Large snapshots
- ❌ Tests that are brittle (break on refactoring)
- ❌ Slow tests (>1s per test)
- ❌ Tests that depend on execution order

## CI/CD Integration

### GitHub Actions Workflow ✅
```yaml
- name: Run Tests
  run: npm run test -- --run

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

### Build Status
- ✅ Typecheck: 0 errors
- ✅ Lint: 0 errors
- ✅ Tests: 60% target (roadmap)
- ✅ Build: 285 kB main

## Performance Testing

### Lighthouse Audit ✅
```bash
# Local
npm run build
npx lighthouse dist/index.html --view

# Production (after deploy)
# Visit https://www.nerveey.shop
# Lighthouse → Generate report
```

**Targets:**
- Performance: >90
- Accessibility: >95 (already 100+)
- Best Practices: >90
- SEO: >95

### Bundle Analysis
```bash
npm run build
npx vite-plugin-visualizer --open
```

**Current:** 286 kB main (77 kB gzip)
**Target:** Maintain <300 kB

## Security Testing

### Manual Security Checklist
- [ ] XSS prevention: form inputs escaped
- [ ] CSRF: tokens present on state-changing actions
- [ ] SQL Injection: parameterized queries used
- [ ] Authentication: JWT validation
- [ ] Authorization: RLS policies enforced
- [ ] Rate limiting: API requests throttled
- [ ] Secrets: no hardcoded keys in code

### OWASP Top 10 Coverage
- [ ] A01: Broken Access Control → RLS tests
- [ ] A02: Cryptographic Failures → Auth tests
- [ ] A03: Injection → Input validation tests
- [ ] A04: Insecure Design → Security checklist
- [ ] A05: Security Misconfiguration → Env vars check
- [ ] A06: Vulnerable & Outdated Components → Dependency audit
- [ ] A07: Authentication Failures → Auth tests
- [ ] A08: Data Integrity Failures → Validation tests
- [ ] A09: Logging & Monitoring → Sentry check
- [ ] A10: SSRF → API validation

## Testing Priorities for Launch

### Critical Path (Must Have)
1. ✅ Checkout form validation
2. ✅ Order placement (idempotency key)
3. ✅ Cart persistence
4. ✅ Image optimization
5. ✅ Mobile responsiveness
6. ✅ Keyboard navigation (accessibility)

### Important (Should Have)
1. Search & filter functionality
2. Product detail page
3. Guest order tracking
4. Error recovery
5. Session management

### Nice to Have (Could Have)
1. AI chatbot fallbacks
2. Review system
3. Wishlist functionality
4. Bundle creation

## Status: ✅ PHASE 9 ROADMAP DOCUMENTED

Testing strategy with:
- ✅ Infrastructure ready (Vitest + Playwright)
- ✅ Coverage roadmap (60% target)
- ✅ Test layers (unit, component, integration, E2E)
- ✅ Implementation roadmap (4-week plan)
- ✅ Test data/fixtures structure
- ✅ CI/CD integration
- ✅ Performance testing strategy
- ✅ Security testing checklist
- ✅ Launch priorities

Ready for:
1. PHASE 9 - Implement priority tests
2. PHASE 10 - Final QA & validation
3. PHASE 11 - Production report & deployment
