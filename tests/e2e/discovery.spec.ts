import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Product discovery — search, suggestions, filters, sorting, URL state,
 * empty/loading states and the mobile filter drawer.
 *
 * Counts asserted here match the live dev catalog served by Supabase
 * (12 active products, prices 750–3450, all with at least one in-stock size):
 * Jackets 3 · Navy 8 · XXL in stock 6 · Navy+XXL 4 · Jackets+Navy 1 ·
 * price ≤ 3400 → 11 · availability filter alone → 12.
 */
const TOTAL = 12;
const BEST_SELLERS = [
  'NERVE CORE TEE',
  'CORE ZIP HOODIE',
  'SIGNATURE JACKET',
  'NERVE ESSENTIALS TEE',
];

/** The ~1.7s splash overlay sits above the page and swallows clicks. */
async function waitForLoader(page: Page) {
  await page
    .waitForFunction(
      () => !document.querySelector('[aria-hidden="true"].fixed.inset-0.z-\\[100\\]'),
      null,
      { timeout: 6000 },
    )
    .catch(() => {});
}

/** Navigate and wait until the toolbar reports a settled result count. */
async function gotoShop(page: Page, path = '/shop') {
  await page.goto(path, { waitUntil: 'load' });
  await expect(
    page.getByTestId('products-grid').or(page.getByTestId('empty-state')).first(),
  ).toBeVisible({ timeout: 15000 });
  await waitForLoader(page);
}

async function searchParam(page: Page, key: string) {
  return page.evaluate(k => new URLSearchParams(window.location.search).get(k), key);
}

/** Product headings in grid order (card → single h3 → trimmed name). */
async function namesIn(cards: Locator) {
  return (await cards.locator('h3').allTextContents()).map(name => name.trim());
}

function locators(page: Page) {
  return {
    cards: page.getByTestId('product-card'),
    input: page.getByTestId('search-input'),
    sort: page.getByTestId('sort-select'),
    // The page renders the filter panel twice (aside + mobile drawer); scope
    // every filter interaction to one of them to keep queries unambiguous.
    filters: page.getByRole('complementary', { name: 'Filters' }),
    drawer: page.getByTestId('mobile-filters'),
    chips: page.getByRole('group', { name: 'Active filters' }),
  };
}

test.describe('Product discovery — search', () => {
  test('search narrows the grid, writes the query to the URL and survives reload', async ({
    page,
  }) => {
    const { cards, input } = locators(page);
    await gotoShop(page);
    await expect(cards).toHaveCount(TOTAL);

    await input.fill('hoodie');
    await expect(page).toHaveURL(/q=hoodie/);
    await expect(cards).toHaveCount(1);
    await expect(page.getByText('Showing 1 of 1 product')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CORE ZIP HOODIE' })).toBeVisible();

    // The URL is the source of truth: a refresh restores the same view.
    await page.reload({ waitUntil: 'load' });
    await expect(input).toHaveValue('hoodie');
    await expect(cards).toHaveCount(1);
  });

  test('a misspelled query falls back to fuzzy matches and says so', async ({ page }) => {
    const { cards } = locators(page);
    await gotoShop(page);

    await locators(page).input.fill('hoddie');
    await expect(page).toHaveURL(/q=hoddie/);
    await expect(page.getByText(/Including close matches for/)).toBeVisible();
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'CORE ZIP HOODIE' })).toBeVisible();
  });

  test('zero results show an empty state with a scoped reset action', async ({ page }) => {
    const { cards, input } = locators(page);
    await gotoShop(page);

    await input.fill('xyzzyq');
    await expect(page).toHaveURL(/q=xyzzyq/);
    const empty = page.getByTestId('empty-state');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No results for');
    await expect(empty).toContainText('xyzzyq');
    // Two "Clear search" controls can coexist — act on the empty-state one.
    await empty.getByRole('button', { name: 'Clear search' }).click();

    await expect(page).not.toHaveURL(/q=/);
    await expect(cards).toHaveCount(TOTAL);
    await expect(empty).toHaveCount(0);
  });

  test('suggestions follow the combobox pattern for keyboard users', async ({ page }) => {
    const { input } = locators(page);
    await gotoShop(page);
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    await input.fill('tee');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    const options = listbox.getByRole('option');
    await expect(options).toHaveCount(3);

    await input.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'shop-search-suggestions-0');
    await input.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'shop-search-suggestions-1');
    await input.press('ArrowUp');
    await expect(input).toHaveAttribute('aria-activedescendant', 'shop-search-suggestions-0');
    // ArrowUp wraps from the first option to the last one.
    await input.press('ArrowUp');
    await expect(input).toHaveAttribute('aria-activedescendant', 'shop-search-suggestions-2');

    // Escape dismisses the popup but keeps the typed term.
    await input.press('Escape');
    await expect(listbox).toBeHidden();
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toHaveValue('tee');

    // ArrowDown reopens with the first option armed; Enter applies it.
    await input.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'shop-search-suggestions-0');
    const firstSuggestion = (await options.first().locator('span').first().innerText()).trim();
    await input.press('Enter');

    await expect(input).toHaveValue(firstSuggestion);
    expect(await searchParam(page, 'q')).toBe(firstSuggestion);
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(page.getByTestId('product-card')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: firstSuggestion })).toBeVisible();
  });

  test('clicking a suggestion applies it to the search box and the URL', async ({ page }) => {
    const { input, cards } = locators(page);
    await gotoShop(page);

    await input.fill('hood');
    const options = page.getByRole('listbox').getByRole('option');
    await expect(options).toHaveCount(1);
    await options.first().click();

    await expect(input).toHaveValue('CORE ZIP HOODIE');
    expect(await searchParam(page, 'q')).toBe('CORE ZIP HOODIE');
    await expect(cards).toHaveCount(1);
  });

  test('typing only replaces history entries so Back leaves the search', async ({ page }) => {
    const { input, cards } = locators(page);
    await gotoShop(page);

    await input.fill('t');
    await input.fill('te');
    await input.fill('tee');
    await expect(page).toHaveURL(/q=tee/);
    await expect(cards).toHaveCount(3);

    await page.goBack();
    await expect(page).not.toHaveURL(/q=/);
    await expect(cards).toHaveCount(TOTAL);
  });
});

test.describe('Product discovery — filters, sorting and URL state', () => {
  test('a shared URL restores category, color and sort state', async ({ page }) => {
    const { cards, sort, filters } = locators(page);
    await gotoShop(page, '/shop?category=Jackets&colors=Navy&sort=price-desc');

    await expect(cards).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'SIGNATURE JACKET' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jackets');
    await expect(sort).toHaveValue('price-desc');
    await expect(filters.getByRole('button', { name: 'Jackets', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(filters.getByRole('button', { name: 'Navy', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const { chips } = locators(page);
    await expect(chips.getByRole('button', { name: 'Remove filter: Jackets' })).toBeVisible();
    await expect(chips.getByRole('button', { name: 'Remove filter: Navy' })).toBeVisible();
  });

  test('category filtering round-trips through browser back and forward', async ({ page }) => {
    const { cards, filters } = locators(page);
    await gotoShop(page);

    await filters.getByRole('button', { name: 'Jackets', exact: true }).click();
    await expect(page).toHaveURL(/category=Jackets/);
    await expect(cards).toHaveCount(3);

    await page.goBack();
    await expect(page).not.toHaveURL(/category=/);
    await expect(cards).toHaveCount(TOTAL);

    await page.goForward();
    await expect(page).toHaveURL(/category=Jackets/);
    await expect(cards).toHaveCount(3);
    await expect(filters.getByRole('button', { name: 'Jackets', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('color and size combine, and chips reset individual facets', async ({ page }) => {
    const { cards, filters, chips } = locators(page);
    await gotoShop(page);

    await filters.getByRole('button', { name: 'Navy', exact: true }).click();
    await filters.getByRole('button', { name: 'XXL', exact: true }).click();
    await expect(page).toHaveURL(/colors=Navy/);
    await expect(page).toHaveURL(/sizes=XXL/);
    await expect(cards).toHaveCount(4);

    await expect(chips.getByRole('button', { name: 'Remove filter: Navy' })).toBeVisible();
    await expect(chips.getByRole('button', { name: 'Remove filter: Size: XXL' })).toBeVisible();
    await chips.getByRole('button', { name: 'Remove filter: Navy' }).click();

    await expect(page).not.toHaveURL(/colors=/);
    await expect(page).toHaveURL(/sizes=XXL/);
    await expect(cards).toHaveCount(6);

    await filters.getByRole('button', { name: 'Navy', exact: true }).click();
    await chips.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(page).not.toHaveURL(/\?/);
    await expect(cards).toHaveCount(TOTAL);
  });

  test('the availability filter round-trips through the URL', async ({ page }) => {
    const { cards, filters, chips } = locators(page);
    await gotoShop(page, '/shop?availability=in-stock');

    const toggle = filters.getByRole('button', { name: 'In stock only' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(chips.getByRole('button', { name: 'Remove filter: In stock only' })).toBeVisible();
    await expect(cards).toHaveCount(TOTAL);

    await toggle.click();
    await expect(page).not.toHaveURL(/availability/);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(cards).toHaveCount(TOTAL);
  });

  test('the price ceiling slider commits to the URL after the user stops', async ({ page }) => {
    const { cards, filters, chips } = locators(page);
    await gotoShop(page);

    const slider = filters.getByLabel('Maximum price');
    await expect(slider).toHaveValue('3450');

    await slider.press('ArrowLeft');
    await expect(page).toHaveURL(/priceMax=3400/);
    await expect(slider).toHaveValue('3400');
    await expect(cards).toHaveCount(11);
    await expect(
      chips.getByRole('button', { name: 'Remove filter: Up to EGP 3,400' }),
    ).toBeVisible();

    // Back to the ceiling — the facet drops out of the URL entirely.
    await slider.press('ArrowRight');
    await expect(page).not.toHaveURL(/priceMax=/);
    await expect(cards).toHaveCount(TOTAL);
  });

  test('sorting orders the grid by price and by best sellers', async ({ page }) => {
    const { cards, sort } = locators(page);
    await gotoShop(page);

    await expect(sort).toHaveValue('newest');

    await sort.selectOption('price-asc');
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(cards.first().getByTestId('product-price')).toHaveText('EGP 750');

    await sort.selectOption('price-desc');
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect(cards.first().getByTestId('product-price')).toHaveText('EGP 3,450');

    await sort.selectOption('best-selling');
    await expect(page).toHaveURL(/sort=best-selling/);
    // Poll: the URL updates in the same commit as the re-render, but engines
    // differ in how soon the grid is repainted relative to the assertion.
    await expect
      .poll(async () => (await namesIn(cards)).slice(0, BEST_SELLERS.length).sort().join('|'))
      .toBe([...BEST_SELLERS].sort().join('|'));
    const names = await namesIn(cards);
    expect(names).toHaveLength(TOTAL);
    expect(BEST_SELLERS).not.toContain(names[BEST_SELLERS.length]);
  });

  test('New Arrivals caps the grid at the eight newest products', async ({ page }) => {
    const { cards, filters } = locators(page);
    await gotoShop(page);

    await filters.getByRole('button', { name: 'New Arrivals', exact: true }).click();
    await expect(page).toHaveURL(/category=/);
    expect(await searchParam(page, 'category')).toBe('New Arrivals');
    await expect(cards).toHaveCount(8);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New Arrivals');
  });

  test('clearing every filter keeps the sort preference', async ({ page }) => {
    const { cards, sort, chips } = locators(page);
    await gotoShop(page, '/shop?category=Jackets&colors=Navy&sort=price-desc');
    await expect(cards).toHaveCount(1);

    await chips.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(page).not.toHaveURL(/category=|colors=/);
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect(sort).toHaveValue('price-desc');
    await expect(cards).toHaveCount(TOTAL);
  });
});

test.describe('Product discovery — mobile filter drawer', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('drawer traps focus, applies filters and closes via button and Escape', async ({ page }) => {
    const { cards, drawer } = locators(page);
    await gotoShop(page);

    // The desktop rail is hidden at this breakpoint; only the drawer is live.
    await expect(page.locator('aside')).toBeHidden();
    const open = page.getByRole('button', { name: 'Open filters' });
    await open.click();

    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#mobile-filters-close')).toBeFocused();

    await drawer.getByRole('button', { name: 'Navy', exact: true }).click();
    await expect(page).toHaveURL(/colors=Navy/);
    await expect(cards).toHaveCount(8);

    const showResults = drawer.getByRole('button', { name: /Show results/ });
    await expect(showResults).toHaveText('Show results (8)');
    await showResults.click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(open).toHaveAttribute('aria-expanded', 'false');
    await expect(cards).toHaveCount(8);

    await open.click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(open).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Product discovery — header search overlay', () => {
  test('hands a suggested query off to the shop', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForLoader(page);

    await page.getByTestId('search-button').click();
    const dialog = page.getByRole('dialog', { name: 'Search products' });
    await expect(dialog).toBeVisible();
    const input = dialog.getByLabel('Search query');

    await input.fill('hood');
    await expect(dialog.getByRole('status').filter({ hasText: /results/ })).toContainText(
      /\d+ results/,
    );
    await dialog.getByRole('link', { name: 'View all results' }).click();

    await expect(page).toHaveURL(/\/shop\?q=hood/);
    await expect(page.getByTestId('products-grid')).toBeVisible();
    await expect(page.getByTestId('product-card').first()).toBeVisible();
    expect(await page.getByTestId('product-card').count()).toBeGreaterThan(0);
  });
});
