import { test, expect } from '@playwright/test';
import { skipGuard, hasBackendSecrets } from './skipGuard';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated accessibility scans with axe-core.
 *
 * Gates serious + critical impacts for every statically reachable page, plus
 * selected moderate rules that map to real WCAG failures and regressed in the
 * past (A11Y-06): heading-order. Checkout needs cart data (seeded through
 * sessionStorage) and the PDP is discovered from the shop grid, so both get
 * their own tests below.
 */

const PAGES = [
  '/',
  '/shop',
  '/cart',
  '/collections',
  '/about',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/shipping',
  '/returns',
  '/size-guide',
  '/track-order',
  '/login',
  '/register',
];

/** Moderate-impact rules promoted to build blockers. */
const BLOCKED_MODERATE = new Set(['heading-order']);

/** Shop's filter/card heading levels are tracked in A11Y-01 (parallel session owns Shop.tsx). */
const HEADING_ORDER_EXEMPT = new Set(['/shop']);

const CART_LINE = JSON.stringify([
  {
    productId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Core Tee',
    slug: 'core-tee-navy',
    image: '/placeholder-product.jpg',
    price: 450,
    color: 'Navy',
    size: 'M',
    quantity: 1,
  },
]);

async function scan(page: import('@playwright/test').Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  // Splash loader fades ~1.7s; mid-transition can trip color-contrast.
  await page
    .waitForFunction(
      () => !document.querySelector('[aria-hidden="true"].fixed.inset-0.z-\\[100\\]'),
      null,
      { timeout: 5000 },
    )
    .catch(() => {});
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    v =>
      v.impact === 'serious' ||
      v.impact === 'critical' ||
      (v.impact === 'moderate' && BLOCKED_MODERATE.has(v.id) && !HEADING_ORDER_EXEMPT.has(path)),
  );
  expect(
    blocking.map(v => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map(n => ({ target: n.target, html: n.html.slice(0, 200) })),
    })),
  ).toEqual([]);
}

test.describe('Accessibility — axe-core scans', () => {
  for (const path of PAGES) {
    test(`no serious/critical violations on ${path}`, async ({ page }) => {
      await scan(page, path);
    });
  }

  test('no serious/critical violations on checkout (seeded cart)', async ({ page }) => {
    await page.addInitScript(cart => {
      sessionStorage.setItem('nerve.cart', cart);
    }, CART_LINE);
    await scan(page, '/checkout');
  });

  test('no serious/critical violations on product detail', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'networkidle' });
    const href = await page.locator('a[href^="/product/"]').first().getAttribute('href');
    // TEST-03: empty catalog — structural skip locally, CI failure with backend secrets
    skipGuard(!href, 'catalog has no product links', { failInCi: hasBackendSecrets() });
    await scan(page, href!);
  });
});
