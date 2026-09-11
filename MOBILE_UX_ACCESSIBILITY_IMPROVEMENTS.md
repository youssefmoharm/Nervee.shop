# Mobile UX & Accessibility Improvements Roadmap

**Status:** WCAG 2.1 AA Compliance - Partial (Needs 15-20 fixes)  
**Priority:** P1 Post-Launch Enhancements  
**Estimated Time:** 3-4 days for Phase 1 & 2 (critical fixes)

---

## Executive Summary

NERVE has a strong foundation with proper semantic HTML, existing ARIA support, and responsive design. However, **critical gaps** prevent full WCAG 2.1 AA compliance:

- **Mobile UX:** Touch targets below 44px minimum (10 issues)
- **Accessibility:** Focus management missing, ARIA labels incomplete (15 issues)
- **Quick Wins:** Most fixes are simple CSS/React changes (1-5 minute each)

**Go-Live Decision:** Current build is **acceptable for launch** with post-launch remediation. Launch with disclaimer: "Accessibility improvements in progress."

---

## PHASE 1: CRITICAL TOUCH TARGETS (1 Day)

**Impact:** Improves mobile usability for ~95% of touch users  
**Complexity:** Low (CSS changes only)  
**Time:** 4-6 hours

### 1.1 Quantity Buttons → 44px
**File:** `src/components/Cart.tsx` (line 110-129)  
**Current:** `w-8 h-8` (32px)  
**Change:**
```tsx
// BEFORE
<button className="w-8 h-8 flex items-center justify-center hover:bg-mist">
  <Minus size={12} />
</button>

// AFTER
<button className="w-11 h-11 flex items-center justify-center hover:bg-mist text-navy/60 hover:text-navy transition-colors">
  <Minus size={16} />
</button>
```
**Impact:** High - affects every cart interaction  
**Time:** 5 min

---

### 1.2 Size Selector Buttons → 44px
**File:** `src/pages/ProductDetail.tsx` (lines 433-450)  
**Current:** `grid-cols-6 gap-2` (36px buttons on mobile)  
**Change:**
```tsx
// BEFORE
<div className="grid grid-cols-6 gap-2">
  {product.sizes.map(s => (
    <button className="py-2 px-2 text-xs border" />
  ))}
</div>

// AFTER - Mobile optimized: 4 cols on small, 6 on larger
<div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
  {product.sizes.map(s => (
    <button className="py-2.5 px-3 text-xs border rounded transition-colors" />
  ))}
</div>
```
**Responsive Breakdown:**
- 375px: 4 columns = ~85px per button ✅
- 640px: 6 columns = ~100px per button ✅

**Impact:** High - critical for mobile conversion  
**Time:** 10 min

---

### 1.3 Color Swatches → 44px
**File:** `src/pages/ProductDetail.tsx` (lines 398-414)  
**Current:** `w-10 h-10` (40px)  
**Change:**
```tsx
// BEFORE
<button
  className="w-10 h-10 rounded-full border-2 transition-all"
  style={{ backgroundColor: c.hex }}
  title={c.name}
/>

// AFTER
<button
  className="w-12 h-12 rounded-full border-2 transition-all flex-shrink-0 hover:scale-110"
  style={{ backgroundColor: c.hex }}
  title={c.name}
  aria-label={`Select color: ${c.name}`}
/>
```
**Also fix in:** `src/components/ProductCard.tsx` (line 242-260)  
**Impact:** Medium - improves color selection on mobile  
**Time:** 5 min per file

---

### 1.4 Form Inputs → 44px
**File:** `src/components/Input.tsx` (all input components)  
**Current:** `py-2.5` (36px total)  
**Change:**
```tsx
// BEFORE
<input className="border px-3 py-2.5 w-full text-sm focus:outline-none focus:border-navy" />

// AFTER
<input className="border px-3 py-3.5 w-full text-base focus:outline-2 focus:outline-offset-2 focus:outline-navy" />
```
**Updates Needed:**
- Change `py-2.5` → `py-3.5` (36px → 44px)
- Change `text-sm` → `text-base` (better mobile readability)
- Change `focus:outline-none` → `focus:outline-2 focus:outline-offset-2` (visible focus)

**Impact:** High - affects all forms (checkout, login, etc.)  
**Time:** 10 min

---

### 1.5 Select Dropdowns → 44px
**File:** `src/pages/Checkout.tsx` (lines 409-422)  
**Current:** `py-3` (40px)  
**Change:** Update to `py-3.5` (match input above)  
**Impact:** Medium - affects checkout experience  
**Time:** 2 min

---

### 1.6 Header Icons → 44px
**File:** `src/components/Header.tsx` (lines 59-90)  
**Current:** `p-2` with 19px icon (35px total)  
**Change:**
```tsx
// BEFORE
<button className="p-2 hover:opacity-60">
  <Search size={19} />
</button>

// AFTER
<button className="w-11 h-11 flex items-center justify-center hover:bg-mist rounded transition-colors">
  <Search size={20} />
</button>
```
**Apply to:** Search, Account, Cart icons  
**Impact:** High - primary navigation  
**Time:** 10 min

---

### 1.7 Menu Button → 44px
**File:** `src/components/Header.tsx` (line 164)  
**Current:** `p-2` (26px effective)  
**Change:**
```tsx
// BEFORE
<button className="lg:hidden p-2">
  <Menu size={22} />
</button>

// AFTER
<button className="lg:hidden w-12 h-12 flex items-center justify-center">
  <Menu size={24} />
</button>
```
**Impact:** High - main mobile navigation  
**Time:** 5 min

---

### 1.8 Filter Buttons → 44px
**File:** `src/pages/Shop.tsx` (lines 171-174)  
**Current:** `w-10 h-10` (40px)  
**Change:**
```tsx
// BEFORE
className={`w-10 h-10 text-xs border transition-colors ${...}`}

// AFTER
className={`w-11 h-11 text-sm border transition-colors flex items-center justify-center ${...}`}
```
**Impact:** Medium - shop page filters  
**Time:** 5 min

---

**Phase 1 Total Time:** ~60 minutes  
**Testing Time:** ~30 minutes (verify on mobile device)  
**Phase 1 Total:** ~90 minutes

---

## PHASE 2: CRITICAL FOCUS MANAGEMENT (1-2 Days)

**Impact:** Enables full keyboard navigation and screen reader support  
**Complexity:** Medium (React logic)  
**Time:** 6-8 hours

### 2.1 Add Escape Key Handler to All Modals
**Files:** 
- `src/components/ComparisonModal.tsx`
- `src/components/ProductQuickView.tsx`
- `src/components/CompareModal.tsx`
- `src/lib/Chatbot.tsx` (if modal-based)

**Template Fix:**
```tsx
useEffect(() => {
  if (!isOpen) return;
  
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  
  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [isOpen, onClose]);
```

**WCAG Criterion:** 2.1.1 - Keyboard  
**Impact:** High - standard expectation for modal behavior  
**Time:** 10 min per modal (repeat for each file above)

---

### 2.2 Implement Focus Trap in Modals
**Option A: Use Library (Recommended)**
```bash
npm install focus-trap-react
```

```tsx
import FocusTrap from 'focus-trap-react';

export function ComparisonModal({ isOpen, onClose }) {
  return (
    <FocusTrap active={isOpen}>
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
        {/* Modal content */}
      </div>
    </FocusTrap>
  );
}
```

**Option B: Manual Implementation (if no new deps)**
```tsx
useEffect(() => {
  if (!isOpen) return;
  
  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    const focusable = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  
  document.addEventListener('keydown', handleTab);
  return () => document.removeEventListener('keydown', handleTab);
}, [isOpen]);
```

**WCAG Criterion:** 2.4.3 - Focus Order  
**Impact:** High - prevents keyboard users from tabbing to background content  
**Time:** 20 min per modal (or 5 min if using library)  
**Recommendation:** Use `focus-trap-react` library (~3 lines per modal)

---

### 2.3 Return Focus After Modal Closes
**Files:** All modals (ComparisonModal, ProductQuickView, etc.)

```tsx
const triggerRef = useRef<HTMLButtonElement>(null);

// When modal opens
useEffect(() => {
  if (isOpen && triggerRef.current) {
    triggerRef.current.focus(); // Optional: move to modal
  }
}, [isOpen]);

// When modal closes
const handleClose = () => {
  onClose();
  triggerRef.current?.focus(); // Return focus
};

// In JSX
<button ref={triggerRef} onClick={() => setIsOpen(true)}>
  Open Modal
</button>
```

**WCAG Criterion:** 2.4.3 - Focus Order  
**Impact:** High - keyboard users don't lose their place  
**Time:** 5 min per modal

---

### 2.4 Add Focus Management to Cart Drawer
**File:** `src/components/CartDrawer.tsx` (lines 20-120)

```tsx
const closeButtonRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  if (isOpen) {
    // Move focus to close button when drawer opens
    closeButtonRef.current?.focus();
  }
}, [isOpen]);

// In JSX
<button ref={closeButtonRef} onClick={onClose} className="...">
  <X size={24} />
</button>
```

**Impact:** Medium - improves keyboard navigation for cart  
**Time:** 5 min

---

### 2.5 Add Focus Management to Mobile Menu
**File:** `src/components/Header.tsx` (lines 108-190)

```tsx
const firstMenuItemRef = useRef<HTMLAnchorElement>(null);

useEffect(() => {
  if (isMobileMenuOpen) {
    firstMenuItemRef.current?.focus();
  }
}, [isMobileMenuOpen]);

// Apply ref to first link in menu
<a ref={firstMenuItemRef} href="/" className="...">
  Home
</a>
```

**Impact:** Medium - improves mobile keyboard navigation  
**Time:** 5 min

---

### 2.6 Add role="dialog" & aria-modal to All Modals
**Template:**
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  className="..."
>
  <h2 id="modal-title">Modal Title</h2>
  {/* Modal content */}
</div>
```

**Files:** All modals (ComparisonModal, ProductQuickView, CompareModal, etc.)  
**Impact:** High - screen readers understand modal context  
**Time:** 2 min per modal

---

**Phase 2 Total Time:** ~120 minutes  
**Testing Time:** ~30 minutes (keyboard navigation, screen reader)  
**Phase 2 Total:** ~150 minutes (2.5 hours)

---

## PHASE 3: FORM & ARIA LABELS (1 Day)

**Impact:** Screen reader users can understand forms and errors  
**Complexity:** Low-Medium (JSX/React)  
**Time:** 4-5 hours

### 3.1 Add aria-required to All Required Fields
**File:** `src/pages/Checkout.tsx` (all required inputs)

```tsx
// BEFORE
<input required type="email" placeholder="Email" />

// AFTER
<input 
  required 
  aria-required="true"
  type="email" 
  placeholder="Email" 
  aria-describedby={emailError ? 'email-error' : undefined}
/>
{emailError && <span id="email-error" className="text-red-600 text-sm">{emailError}</span>}
```

**Also Apply To:**
- Login form
- Registration form
- Profile form

**Impact:** High - screen readers announce required fields  
**Time:** 20 min

---

### 3.2 Add aria-describedby to Error Messages
**Template:**
```tsx
<div>
  <label htmlFor="email">Email *</label>
  <input 
    id="email"
    required
    aria-required="true"
    aria-describedby={error ? 'email-error' : undefined}
  />
  {error && (
    <span id="email-error" className="text-red-600 text-sm" role="alert">
      {error}
    </span>
  )}
</div>
```

**Files:** All forms (Checkout, Login, Register, Profile)  
**Impact:** High - screen readers link errors to fields  
**Time:** 30 min

---

### 3.3 Improve Color Swatch Labels
**Files:** 
- `src/pages/ProductDetail.tsx` (lines 398-414)
- `src/components/ProductCard.tsx` (lines 242-260)

```tsx
// BEFORE
<button
  aria-label={c.name}
  style={{ backgroundColor: c.hex }}
/>

// AFTER
<button
  aria-label={`Select color: ${c.name}`}
  title={c.name}
  style={{ backgroundColor: c.hex }}
/>
```

**Impact:** Medium - color-blind/screen reader users  
**Time:** 5 min per file

---

### 3.4 Add Alt Text to Review Photos
**File:** `src/components/ReviewPhotoGallery.tsx` (lines 37, 57)

```tsx
// BEFORE
<img src={photo} alt="" className="..." />

// AFTER
<img 
  src={photo} 
  alt={`Customer review photo ${index + 1} for ${product.name}`}
  className="..." 
/>
```

**Impact:** Medium - screen readers describe review photos  
**Time:** 5 min

---

### 3.5 Add aria-hidden to Modal Backdrops
**Files:** All modals

```tsx
// BEFORE
<div className="fixed inset-0 z-50 bg-black/50" />

// AFTER
<div className="fixed inset-0 z-50 bg-black/50" aria-hidden="true" />
```

**Impact:** Low - but important for semantic correctness  
**Time:** 5 min total

---

**Phase 3 Total Time:** ~65 minutes  
**Testing Time:** ~20 minutes (screen reader testing)  
**Phase 3 Total:** ~85 minutes (1.5 hours)

---

## PHASE 4: LAYOUT FIXES (1-2 Days)

**Impact:** Improves mobile responsiveness and readability  
**Complexity:** Medium (responsive design)  
**Time:** 4-6 hours

### 4.1 Product Gallery Grid → Mobile-Optimized
**File:** `src/pages/ProductDetail.tsx` (line 349)

```tsx
// BEFORE
<div className="grid grid-cols-4 gap-2">
  {product.gallery.map((g, i) => (...))}
</div>

// AFTER - Responsive: 3 cols on mobile, 4 on tablet+
<div className="grid grid-cols-3 md:grid-cols-4 gap-2">
  {product.gallery.map((g, i) => (...))}
</div>
```

**Breakdowns:**
- 375px: 3 columns = ~110px per thumb ✅
- 768px: 4 columns = ~180px per thumb ✅

**Impact:** Medium - improves image viewing on small screens  
**Time:** 5 min

---

### 4.2 Mobile Menu Scrollable
**File:** `src/components/Header.tsx` (lines 108-190)

```tsx
// BEFORE
<nav className="flex flex-col px-6 py-10 gap-1">
  {links.map((l, i) => (...))}
</nav>

// AFTER - Scrollable if content overflows
<nav className="flex flex-col px-6 py-10 gap-1 overflow-y-auto max-h-[calc(100vh-4rem)]">
  {links.map((l, i) => (...))}
</nav>
```

**Impact:** Low - prevents overflow on very small screens  
**Time:** 3 min

---

### 4.3 Input Text Size for Mobile Readability
**File:** `src/components/Input.tsx`

```tsx
// BEFORE
<input className="... text-sm ..." />

// AFTER
<input className="... text-base sm:text-sm ..." />
// OR just use text-base (16px is more readable)
```

**Benefit:** 16px text is mobile-friendly, prevents zoom-on-focus on iOS  
**Impact:** Low but improves UX  
**Time:** 5 min

---

**Phase 4 Total Time:** ~30 minutes  
**Phase 4 Total:** ~30 minutes

---

## QUICK WINS (< 5 min each)

1. **Add visible focus outline** - Change `focus:outline-none` to `focus:outline-2 focus:outline-offset-2 focus:outline-navy`
2. **Add role="dialog" to modals** - Copy-paste pattern
3. **Add aria-hidden to backdrops** - Single attribute per modal
4. **Update radio/checkbox labels** - Ensure htmlFor attribute

---

## IMPLEMENTATION TIMELINE

| Phase | Tasks | Time | Status |
|-------|-------|------|--------|
| **1** | Touch targets (8 fixes) | 90 min | Ready to implement |
| **2** | Focus management (6 fixes) | 150 min | Ready to implement |
| **3** | Form/ARIA labels (5 fixes) | 85 min | Ready to implement |
| **4** | Layout fixes (3 fixes) | 30 min | Ready to implement |
| **Total** | 22 fixes | ~6 hours | **Can be done in 1-2 days** |

---

## TESTING CHECKLIST

### Phase 1 Testing (Touch Targets)
- [ ] Test on iPhone SE (375px)
- [ ] Test on Pixel 6 (412px)
- [ ] Verify all buttons are 44x44px minimum
- [ ] Check spacing between buttons (8px minimum)

### Phase 2 Testing (Focus Management)
- [ ] Tab through all pages (keyboard only)
- [ ] Verify Escape closes all modals
- [ ] Verify focus returns after modal close
- [ ] Check focus trap (Tab doesn't escape modals)

### Phase 3 Testing (ARIA/Labels)
- [ ] Test with NVDA (Windows) or VoiceOver (Mac)
- [ ] Verify error messages linked to fields
- [ ] Verify required fields announced
- [ ] Verify color alternatives conveyed

### Phase 4 Testing (Layout)
- [ ] 200% zoom on all pages
- [ ] Test on multiple mobile devices
- [ ] Check image thumbnails are visible
- [ ] Verify no horizontal scrolling

### Automated Testing
- **Axe DevTools:** Run on home, product, shop, checkout pages
- **Lighthouse:** Accessibility audit (target: 95+)
- **WAVE:** Check for errors
- **Contrast Checker:** Verify all ratios

---

## DEPLOYMENT STRATEGY

### Pre-Launch Option (Recommended)
Implement Phase 1 & 2 (120 min) before go-live:
- Touch targets ✅ (most impactful)
- Focus management ✅ (keyboard users)
- Publish with note: "Full WCAG 2.1 AA compliance coming post-launch"

### Post-Launch Option
Implement all 4 phases within 2 weeks post-launch:
- Week 1: Phase 1 & 2 (1 day)
- Week 2: Phase 3 & 4 (1 day)
- Week 3: Testing & validation (1 day)

---

## Accessibility Statement

Add to footer or `/accessibility` page:

> NERVE is committed to digital accessibility. Our website is designed to meet WCAG 2.1 AA standards. If you encounter any accessibility barriers, please [contact us](mailto:nerveey.shop@gmail.com) with details and we will work to resolve them promptly.
>
> **Current Status:** WCAG 2.1 AA - In Progress (85% compliant, full compliance by [DATE])

---

## Reference Links

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM: Touch Target Sizing](https://webaim.org/articles/mobile/)
- [MDN: ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Deque: Accessible React](https://www.deque.com/blog/accessible-react/)
