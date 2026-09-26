import { test, expect, type Page } from '@playwright/test';

/**
 * FloatingDock positioning verification — the compare FAB and AI chat trigger
 * must both stay visible, stacked, non-overlapping and inside the viewport at
 * desktop / tablet / 375 / 390 / 412 widths, including with the cookie banner
 * and the PDP sticky CTA clearances active.
 */

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 667 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-412', width: 412, height: 915 },
] as const;

type Box = { x: number; y: number; width: number; height: number };

const SEED_PRODUCT = {
  id: 'verify-1',
  slug: 'verify-product-1',
  name: 'VERIFY PRODUCT',
  category: 'T-Shirts',
  collection_id: null,
  price: 750,
  compare_at_price: null,
  currency: 'EGP',
  product_colors: [
    { name: 'Navy', hex: '#001f3f', image: '/mock.jpg', hover_image: null, sort_order: 0 },
  ],
  badge: null,
  description: 'Seed product for dock verification',
  material: 'Cotton',
  care: [],
  gallery: ['/mock.jpg'],
  is_best_seller: false,
  created_at: '2026-01-01T00:00:00.000Z',
  is_active: true,
  fit_notes: null,
  low_stock_threshold: null,
};

async function seed(page: Page, opts: { consent: boolean; compare: boolean }) {
  await page.addInitScript(
    (o: { consent: boolean; compare: boolean; product: typeof SEED_PRODUCT }) => {
      if (o.consent) localStorage.setItem('nerve.cookieConsent', 'granted');
      if (o.compare) {
        localStorage.setItem('nerve.comparison', JSON.stringify([o.product.id]));
        localStorage.setItem('nerve.comparison_full', JSON.stringify([o.product]));
      }
    },
    { ...opts, product: SEED_PRODUCT },
  );
}

const compareFab = (page: Page) => page.getByRole('button', { name: /^Compare \d+ products/ });
const chatFab = (page: Page) => page.getByRole('button', { name: 'Open AI chat support' });

function expectDocked(label: string, box: Box | null, width: number, height: number) {
  expect(box, `${label}: rendered`).not.toBeNull();
  const b = box as Box;
  const rightGap = width - (b.x + b.width);
  const bottomGap = height - (b.y + b.height);
  const metrics = {
    label,
    rightGap: +rightGap.toFixed(1),
    bottomGap: +bottomGap.toFixed(1),
    x: +b.x.toFixed(1),
    y: +b.y.toFixed(1),
  };
  // eslint-disable-next-line no-console
  console.log('MEASURE ' + JSON.stringify(metrics));
  expect(b.x >= -0.5, `${label}: not clipped left`).toBeTruthy();
  expect(b.y >= -0.5, `${label}: not clipped top`).toBeTruthy();
  expect(
    rightGap >= 14,
    `${label}: >=14px from right edge (got ${rightGap.toFixed(1)})`,
  ).toBeTruthy();
  expect(
    bottomGap >= 14,
    `${label}: >=14px from bottom edge (got ${bottomGap.toFixed(1)})`,
  ).toBeTruthy();
  return metrics;
}

test.describe('FloatingDock positioning', () => {
  test('compare and chat FABs stack without overlap at every breakpoint', async ({ page }) => {
    await seed(page, { consent: true, compare: true });
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/shop');

      const compare = await compareFab(page).boundingBox();
      const chat = await chatFab(page).boundingBox();
      expectDocked(`${vp.name}/compare`, compare, vp.width, vp.height);
      expectDocked(`${vp.name}/chat`, chat, vp.width, vp.height);

      const c = compare as Box;
      const h = chat as Box;
      // Stacked: compare above chat, with the dock gap between them.
      const verticalGap = h.y - (c.y + c.height);
      expect(
        verticalGap >= 8,
        `${vp.name}: gap between FABs >= 8px (got ${verticalGap})`,
      ).toBeTruthy();
      // Horizontally aligned: identical right inset.
      const rightDelta = Math.abs(c.x + c.width - (h.x + h.width));
      expect(rightDelta <= 1, `${vp.name}: right edges aligned (delta ${rightDelta})`).toBeTruthy();
      // Combined with the vertical gap above, the boxes cannot intersect.
    }
  });

  test('cookie banner lifts the dock and hides chat until a choice is made', async ({ page }) => {
    await seed(page, { consent: false, compare: true });
    for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      await expect(chatFab(page)).toHaveCount(0);
      const compare = await compareFab(page).boundingBox();
      expectDocked(`${vp.name}/banner/compare`, compare, vp.width, vp.height);

      const banner = await page.getByTestId('cookie-consent').boundingBox();
      expect(banner, `${vp.name}: banner rendered`).not.toBeNull();
      const c = compare as Box;
      const b = banner as Box;
      // eslint-disable-next-line no-console
      console.log(
        'MEASURE ' +
          JSON.stringify({
            label: `${vp.name}/banner`,
            y: +b.y.toFixed(1),
            height: +b.height.toFixed(1),
          }),
      );
      expect(c.y + c.height <= b.y + 1, `${vp.name}: compare sits above the banner`).toBeTruthy();
    }
  });

  test('open chat panel clears the compare FAB and stays on screen', async ({ page }) => {
    await seed(page, { consent: true, compare: true });
    for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/shop');
      await chatFab(page).click();

      const panel = await page.locator('.nv-chat-panel').boundingBox();
      expectDocked(`${vp.name}/panel`, panel, vp.width, vp.height);
      await expect(chatFab(page)).toHaveCount(0);

      const compare = await compareFab(page).boundingBox();
      const p = panel as Box;
      const c = compare as Box;
      const gap = c.y - (p.y + p.height);
      expect(
        gap >= -1,
        `${vp.name}: panel bottom clears compare FAB (gap ${gap.toFixed(1)})`,
      ).toBeTruthy();
    }
  });

  test('PDP sticky CTA clearance keeps both FABs above it on mobile', async ({ page }) => {
    test.setTimeout(60000);
    await seed(page, { consent: true, compare: true });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/shop');
    await page.getByTestId('product-card').first().waitFor();
    await page.getByTestId('product-card').first().locator('a').first().click();
    await page.waitForURL(/\/product\//, { timeout: 15000 });
    const sticky = page.locator('[data-pdp-sticky-cta]');
    await sticky.waitFor({ timeout: 15000 });

    const compare = await compareFab(page).boundingBox();
    const chat = await chatFab(page).boundingBox();
    const cta = await sticky.boundingBox();
    expectDocked('pdp/compare', compare, 375, 667);
    expectDocked('pdp/chat', chat, 375, 667);
    expect(cta, 'pdp: sticky CTA rendered').not.toBeNull();

    const c = compare as Box;
    const h = chat as Box;
    const s = cta as Box;
    expect(c.y + c.height <= s.y + 1, 'pdp: compare above sticky CTA').toBeTruthy();
    expect(h.y + h.height <= s.y + 1, 'pdp: chat above sticky CTA').toBeTruthy();
    const verticalGap = h.y - (c.y + c.height);
    expect(verticalGap >= 8, `pdp: FAB gap ${verticalGap}`).toBeTruthy();
  });
});
