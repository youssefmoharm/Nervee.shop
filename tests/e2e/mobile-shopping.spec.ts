import { test, expect } from '@playwright/test';
test('mobile filters restore the URL and support touch navigation', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch filter drawer is tested in the mobile project');
  await page.goto('/shop?category=Jackets&colors=Navy&sort=price-desc');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jackets');
  await page.getByRole('button', { name: 'Open filters', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Filters', exact: true });
  await expect(filters).toBeVisible();
  await expect(filters.getByRole('button', { name: 'Jackets', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(filters.getByRole('button', { name: 'Navy', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(filters).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open filters', exact: true })).toBeFocused();
});
