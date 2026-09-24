import { test, expect, type Page } from '@playwright/test';

/**
 * Cookie consent must gate analytics script loading (GA4 / Meta Pixel).
 *
 * Skipped entirely unless analytics IDs are present in the environment —
 * without VITE_GA_ID / VITE_META_PIXEL_ID the app intentionally never loads
 * tracking scripts, so the assertions would be meaningless.
 */
const HAS_ANALYTICS_IDS = Boolean(process.env.VITE_GA_ID || process.env.VITE_META_PIXEL_ID);

async function analyticsScriptSrcs(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.scripts)
      .map(s => s.src || '')
      .filter(src => src.includes('googletagmanager.com') || src.includes('connect.facebook.net')),
  );
}

test.describe('Cookie consent gates analytics', () => {
  test('no gtag/fbq scripts before accepting; they load after accepting', async ({ page }) => {
    test.skip(!HAS_ANALYTICS_IDS, 'VITE_GA_ID / VITE_META_PIXEL_ID not set in this environment');

    await page.goto('/', { waitUntil: 'networkidle' });

    // Banner must be present on a fresh visit (no stored consent)
    const banner = page.getByTestId('cookie-consent');
    await expect(banner).toBeVisible();

    // Before consent: no analytics scripts may be present
    expect(await analyticsScriptSrcs(page)).toEqual([]);

    // Accept all → App re-runs initAnalytics via the consent event
    await page.getByTestId('cookie-accept').click();
    await expect(banner).toBeHidden();

    // After consent: the configured provider script(s) must load
    await expect
      .poll(async () => (await analyticsScriptSrcs(page)).length, { timeout: 10000 })
      .toBeGreaterThan(0);
  });
});
