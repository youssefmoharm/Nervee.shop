import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated accessibility scans with axe-core.
 *
 * Deliberately filters to `serious` + `critical` impacts only: minor/moderate
 * flags (e.g. color-contrast on decorative elements, select-name nits) are
 * too flaky to gate CI on, while serious/critical map to real WCAG A/AA
 * blockers for users of assistive tech.
 *
 * Checkout is skipped — it requires cart data and is covered by the
 * customer-flow journey instead.
 */
const PAGES = ['/', '/shop', '/cart'];

test.describe('Accessibility — axe-core scans', () => {
  for (const path of PAGES) {
    test(`no serious/critical violations on ${path}`, async ({ page }) => {
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
      const serious = results.violations.filter(
        v => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(serious.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))).toEqual([]);
    });
  }
});
