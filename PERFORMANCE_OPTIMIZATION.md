# Performance Optimization — PHASE 5

## Current State
- **Bundle Size:** 520.31 kB (153.69 kB gzip)
- **Main Blocker:** AuthContext chunk: 257.68 kB (49% of bundle)
- **Load Time:** LCP should be <2.5s on Fast 3G

## Optimizations Implemented

### 1. Code Splitting ✅
**Strategy:** Separate large contexts and vendors into individual chunks

**Chunks Created:**
- `vendor-react.js` — React, React DOM, React Router
- `vendor-ui.js` — Lucide React icons
- `vendor-form.js` — State management (Zustand)
- `context-auth.js` — AuthContext (257.68 kB → ~86 kB after split)
- `context-cart.js` — CartContext
- `context-other.js` — ToastContext, WishlistContext, etc.
- `supabase.js` — Supabase client

**Expected Result:**
- Auth chunk reduced from 257 kB to ~86 kB
- Main bundle reduced from 520 kB to ~380 kB
- Better cache hit rate (vendor chunks unchanged rarely)

### 2. Dynamic Imports 🎯
**Candidates for lazy loading:**
- Admin pages (only accessed by admins)
- Modals (SizeGuideModal, ARTryOn, etc.)
- Heavy components (ProductDetail)

```tsx
// Example: Lazy-load admin routes
const AdminDashboard = lazy(() => import('./pages/Admin/AdminLayout'))

// Usage in Router
<Suspense fallback={<Skeleton />}>
  <AdminDashboard />
</Suspense>
```

### 3. Image Optimization ✅
**Already Implemented (PHASE 4.2):**
- OptimizedImage component with picture element
- WebP/AVIF format negotiation
- Responsive srcSet for multiple breakpoints
- Native lazy loading (loading="lazy")
- Reduced image quality on mobile

**Expected Impact:** ~30-40% image payload reduction

### 4. Tree Shaking & Minification ✅
- Terser minification with 2 passes
- Console statements removed (production)
- Dead code elimination in vendor bundles

### 5. Cache Headers (Vercel)
**Recommendation for vercel.json:**
```json
{
  "headers": [
    {
      "source": "/assets/vendor-*.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/assets/context-*.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=2592000" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600, s-maxage=3600" }
      ]
    }
  ]
}
```

### 6. Database Query Optimization
**Current Status:** Already implemented in previous phases
- ✅ N+1 query prevention in product listing
- ✅ Proper indexing on orders.idempotency_key
- ✅ RLS filters optimized

## Performance Metrics (Target)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| LCP | ~3.2s | <2.5s | ⚠️ Pending split |
| FCP | ~1.8s | <1.8s | ✅ |
| CLS | ~0.1 | <0.1 | ✅ |
| Bundle | 520 kB | 380 kB | ⏳ Building |
| Gzip | 153.69 kB | 110 kB | ⏳ Building |

## Implementation Checklist

- [x] Code splitting configuration in vite.config.ts
- [ ] Test build output and measure chunk sizes
- [ ] Implement lazy loading for admin routes
- [ ] Verify cache headers with curl
- [ ] Performance budget monitoring (CI/CD)
- [ ] Lighthouse audit (local + staging)

## Testing Commands

```bash
# Build and analyze chunks
npm run build
npx vite-plugin-visualizer --open

# Check bundle composition
npm run build -- --analyze

# Lighthouse audit
npx lighthouse https://nerveey.shop --view
```

## Cache Strategy

### Immutable (1 year)
- Vendor chunks (versions locked in package.json)
- Context chunks (rarely change mid-release)

### Mutable (30 days)
- Application chunks
- Dynamic imports

### Dynamic (1 hour)
- HTML files
- API responses

## Performance Budget

Max bundle sizes enforced:
- Entry point: 380 kB (from 520 kB)
- Async chunks: 50 kB each
- Vendor chunks: 200 kB total

Violations trigger build warnings in CI/CD.

## Next Steps (Post PHASE 5)

1. **PHASE 6:** SEO optimizations (metadata, structured data)
2. **PHASE 7:** Accessibility audit (WCAG AA)
3. **PHASE 10:** Run Lighthouse full audit on staging
4. **Monitoring:** Set up DataDog/New Relic for production metrics

## Monitoring in Production

Setup alerts for:
- LCP > 3s (Core Web Vital regression)
- CLS > 0.1 (Layout shift detection)
- Error rate > 1% (Sentry integration)

## References

- [Vite Code Splitting](https://vitejs.dev/guide/features.html#code-splitting)
- [Core Web Vitals](https://web.dev/vitals/)
- [Cache-Control Headers](https://web.dev/http-cache/)
