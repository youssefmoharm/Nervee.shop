# Remaining Issues in Nerve Project

## 🔴 CRITICAL (Must Fix)

### 1. XSS Vulnerability in Analytics
**File:** `src/lib/analytics.ts` (line 75)
**Problem:** Uses `script.innerHTML` to inject Facebook Pixel code without sanitization
```typescript
script.innerHTML = `...fbq code...` // VULNERABLE
```
**Impact:** Potential XSS if fbq code source is compromised
**Fix:** Use DOM API or sanitized approach

### 2. Unhandled Promise Rejections in Cart Service
**Files:** `src/services/cartService.ts`, `src/services/orderService.ts`
**Problems:**
- `.upsertLine()` - No error handling
- `.removeLine()` - Async but no error propagation
- `.updateQuantity()` - Silent failures
- `orderService.listMine()` - Doesn't catch Supabase errors
**Impact:** Silent failures, no user feedback on errors

### 3. TypeScript Type Errors in Edge Functions
**Files:** `supabase/functions/handle-unsubscribe/index.ts` and others
**Problem:** Deno imports untyped (Request type, Deno.env)
**Impact:** Type checking fails in CI/CD

### 4. Missing Error Handling for Post-Order Emails
**File:** `supabase/functions/create-order/index.ts`
**Problem:** If email send fails after order placement, user doesn't know
**Impact:** Orders created but no confirmation email - critical UX issue

---

## 🟠 HIGH PRIORITY

### 5. Loose Phone Number Validation
**File:** `src/pages/Checkout.tsx` (line 70)
**Current:** `/^[0-9+ ]{8,}$/` - Too lenient, allows spaces/special chars
**Should:** Enforce strict format like `+201xxxxxxxxx` or `01xxxxxxxxx`

### 6. TypeScript Strict Mode Disabled
**File:** `tsconfig.json`
```json
"noUnusedLocals": false,        // Should be true
"noUnusedParameters": false      // Should be true
```
**Impact:** Dead code accumulates, hard to refactor

### 7. Accessibility: Missing Focus Management
**Files:** `src/components/SearchOverlay.tsx`, `src/components/CartDrawer.tsx`
**Problem:** Modals don't trap focus or restore focus on close
**Impact:** Screen reader users trapped, keyboard navigation broken

### 8. Missing Error Boundaries
**File:** `src/App.tsx`
**Problem:** Only root-level boundary, no section-level protection
**Impact:** One component error crashes entire app

### 9. @tanstack/react-query-devtools in Production
**File:** `package.json` (devDependencies)
**Problem:** Should only be imported in dev mode
**Impact:** Extra bundle size, exposes dev tools

### 10. No Retry Logic for Failed API Calls
**Files:** All service files
**Problem:** Network errors fail silently with no retry
**Impact:** Transient failures are permanent

---

## 🟡 MEDIUM PRIORITY

### 11. Missing Test Coverage
**Issues:**
- No checkout flow end-to-end tests
- Admin functionality completely untested
- Auth edge cases untested
- Service error scenarios untested

### 12. Product Out-of-Stock Edge Case
**File:** `src/pages/Checkout.tsx`
**Problem:** Items can be in cart but go out of stock before checkout
**Impact:** Order fails at submission, poor UX

### 13. Session Expiration During Checkout
**Files:** `src/context/AuthContext.tsx`
**Problem:** No handling if auth token expires mid-checkout
**Impact:** Order submission fails, no recovery path

### 14. Image Loading Failures
**Files:** `src/components/ProductCard.tsx`, `src/pages/ProductDetail.tsx`
**Problem:** No fallback for broken image URLs
**Impact:** Broken images in UI

### 15. Mobile Responsiveness Issues
**Files:** `src/components/Header.tsx`, `src/components/CartDrawer.tsx`
**Problems:**
- Sticky header may cover content on mobile
- Touch events not optimized
- Landscape orientation not handled

### 16. Accessibility: Missing ARIA Labels
**Files:** Multiple components
**Issues:**
- Quantity +/- buttons lack aria-labels
- Toast notifications missing `role="alert"` and `aria-live`
- Prices read as words not numbers

### 17. Admin Pagination Missing
**Files:** `src/pages/Admin/Orders.tsx`, `src/pages/Admin/Customers.tsx`
**Problem:** No pagination on potentially large lists
**Impact:** Loads all records, performance issue

### 18. N+1 Query Problem
**File:** `src/services/cartService.ts` in `.fetchMine()`
**Problem:** Fetches cart then separately fetches each item's product data
**Impact:** Could be slow with many cart items

### 19. Missing JSDoc Documentation
**All service files**
**Missing:**
- Parameter documentation
- Return type documentation
- Error documentation
- Usage examples

### 20. Missing CSRF Protection
**Files:** Form components
**Problem:** No CSRF token validation visible
**Impact:** Forms vulnerable to cross-site attacks (if no SameSite cookies)

---

## 🟢 LOW PRIORITY (Nice to Have)

### 21. Code Splitting Not Optimized
- Admin routes imported together, not individually lazy
- Product images not WebP optimized

### 22. No Pagination on Admin Reports
- Top products report unbounded

### 23. Inconsistent Error Handling Patterns
- Some services use `logError()`, others don't

### 24. TypeScript `as any` Casts
- ~20+ places using `as any` instead of proper types

### 25. No Content Security Policy (CSP) Headers
- Missing for additional XSS protection

---

## Action Plan

### Phase 1: Critical Fixes (Today)
1. Fix XSS in analytics (Facebook Pixel)
2. Add error handling to cart service
3. Add error handling to email failures
4. Fix TypeScript edge function types

### Phase 2: High Priority (This Week)
5. Enable strict TypeScript mode
6. Add error boundaries
7. Fix accessibility focus management
8. Fix phone number validation
9. Remove dev tools from production

### Phase 3: Medium Priority (Next Week)
10. Add checkout flow error handling
11. Add session expiration handling
12. Add image fallbacks
13. Add retry logic to services
14. Add missing test coverage

### Phase 4: Nice to Have
15. JSDoc documentation
16. Mobile optimization
17. Type safe casts
18. CSP headers

---

## Severity Matrix

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Security | 3 | 1 | 1 | 1 | - |
| Error Handling | 4 | 2 | 2 | - | - |
| Type Safety | 2 | 1 | 1 | - | - |
| Accessibility | 4 | - | 1 | 2 | 1 |
| Testing | 1 | - | - | 1 | - |
| Performance | 3 | - | - | 2 | 1 |
| UX/Edge Cases | 5 | - | 2 | 3 | - |
| Code Quality | 3 | - | 1 | 1 | 1 |
| **TOTAL** | **25** | **4** | **8** | **10** | **3** |

---

## Next Steps

Starting with fixes for:
1. ✅ XSS vulnerability 
2. ✅ Cart service errors
3. ✅ Edge function types
4. ✅ Order email errors
5. ✅ TypeScript strict mode
