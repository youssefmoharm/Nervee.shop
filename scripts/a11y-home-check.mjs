import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const port = process.env.PORT || '5174';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze();

const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
for (const v of serious) {
  console.log('VIOLATION', v.id, v.impact, v.help);
  for (const n of v.nodes) {
    console.log(' target:', n.target);
    console.log(' html:', n.html.slice(0, 300));
    console.log(' failure:', n.failureSummary);
  }
}
if (serious.length === 0) console.log('NO serious/critical violations');
await browser.close();
