import { test, expect, type Page } from '@playwright/test';

/**
 * The app body is `bg-navy text-paper`, so any element that does not set its own
 * text colour inherits white. On a white or mist surface that makes the text
 * invisible — the bug these tests guard against (see SizeGuide / Footer).
 *
 * `minTextContrast` measures the lowest WCAG contrast ratio between the text of
 * every matching element and the first ancestor background that is actually
 * painted. 1.0 means "text colour == background colour", i.e. unreadable.
 */
async function minTextContrast(
  page: Page,
  selector: string,
): Promise<{ min: number; count: number; worst: string | null }> {
  return page.evaluate(sel => {
    const parse = (value: string) => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const n = v / 255;
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const paintedBg = (start: Element) => {
      let el: Element | null = start;
      while (el) {
        const c = parse(getComputedStyle(el).backgroundColor);
        if (c && c.a > 0.5) return c;
        el = el.parentElement;
      }
      return { r: 255, g: 255, b: 255 };
    };

    let min = Infinity;
    let count = 0;
    let worst: string | null = null;
    document.querySelectorAll(sel).forEach(el => {
      const text = Array.from(el.childNodes)
        .filter(n => n.nodeType === 3)
        .map(n => n.textContent || '')
        .join('')
        .trim();
      if (!text) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      const fg = parse(cs.color);
      if (!fg || fg.a < 0.5) return;
      const bg = paintedBg(el);
      const l1 = Math.max(lum(fg), lum(bg));
      const l2 = Math.min(lum(fg), lum(bg));
      const ratio = (l1 + 0.05) / (l2 + 0.05);
      count++;
      if (ratio < min) {
        min = ratio;
        worst = `${el.tagName} "${text.slice(0, 24)}" ${cs.color} on rgb(${bg.r},${bg.g},${bg.b})`;
      }
    });
    return { min: count ? min : Infinity, count, worst };
  }, selector);
}

test.describe('Contrast — text never matches the surface behind it', () => {
  test('size calculator table, inputs and close control are legible', async ({ page }) => {
    await page.goto('/size-guide', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /use size calculator/i }).click();
    await expect(page.getByRole('heading', { name: 'Find Your Size' })).toBeVisible();

    // The calculator is the fixed overlay; scope to it so the page's own
    // (navy-headed) chart table is not counted.
    const modal = 'div.fixed.inset-0.z-50';

    const cells = await minTextContrast(page, `${modal} table th, ${modal} table td`);
    expect(cells.count, 'size chart cells should render').toBeGreaterThan(10);
    expect(cells.min, `lowest contrast: ${cells.worst}`).toBeGreaterThan(2);

    const modalText = await minTextContrast(
      page,
      `${modal} h2, ${modal} h3, ${modal} label, ${modal} p`,
    );
    expect(modalText.min, `lowest contrast: ${modalText.worst}`).toBeGreaterThan(2);

    // A typed measurement must be readable too (inputs inherit their colour).
    await page.locator('#chest-input').fill('96');
    const inputContrast = await page.evaluate(() => {
      const el = document.querySelector('#chest-input');
      if (!el) return 0;
      const m = getComputedStyle(el).color.match(/rgba?\(([^)]+)\)/);
      if (!m) return 0;
      const [r, g, b] = m[1].split(',').map(Number);
      const f = (v: number) => {
        const n = v / 255;
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
      };
      const fg = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      return 1.05 / (fg + 0.05);
    });
    expect(inputContrast, 'typed text must contrast with the white input').toBeGreaterThan(2);
  });

  test('footer headings and links are legible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const footer = await minTextContrast(page, 'footer h3, footer p, footer a, footer span');
    expect(footer.count).toBeGreaterThan(5);
    expect(footer.min, `lowest contrast: ${footer.worst}`).toBeGreaterThan(2);
  });

  test('shared wishlist headings are legible', async ({ page }) => {
    await page.goto('/wishlist/does-not-exist', { waitUntil: 'networkidle' });
    const heading = await minTextContrast(page, 'h1, h2, p');
    expect(heading.count).toBeGreaterThan(0);
    expect(heading.min, `lowest contrast: ${heading.worst}`).toBeGreaterThan(2);
  });
});
