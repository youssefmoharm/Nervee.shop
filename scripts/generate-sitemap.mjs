#!/usr/bin/env node
/**
 * Generate public/sitemap.xml with dynamic product URLs.
 * Run at build time: node scripts/generate-sitemap.mjs
 * Requires VITE_SUPABASE_URL + your_removed_credential_here (or uses prod values from env only).
 * Fails the build if the product fetch fails — never silently ships a partial sitemap.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf-8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* file optional */
  }
}

loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '.env.local'));

const STORE_URL = process.env.STORE_URL || process.env.VITE_APP_URL || 'https://www.nerveey.shop';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.your_removed_credential_here;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    'Sitemap: missing VITE_SUPABASE_URL or your_removed_credential_here. ' +
      'Set them in the build environment (Vercel project settings).',
  );
  process.exit(1);
}

async function fetchProducts() {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/products?select=slug,updated_at&is_active=eq.true`,
        {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        },
      );
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        lastError = 'unexpected response shape';
        continue;
      }
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  console.error(`Sitemap: product fetch failed after 3 attempts (${lastError}).`);
  process.exit(1);
}

const staticUrls = [
  { loc: `${STORE_URL}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${STORE_URL}/shop`, changefreq: 'daily', priority: '0.9' },
  { loc: `${STORE_URL}/collections`, changefreq: 'weekly', priority: '0.8' },
  { loc: `${STORE_URL}/about`, changefreq: 'monthly', priority: '0.5' },
  { loc: `${STORE_URL}/faq`, changefreq: 'monthly', priority: '0.6' },
  { loc: `${STORE_URL}/size-guide`, changefreq: 'monthly', priority: '0.5' },
  { loc: `${STORE_URL}/contact`, changefreq: 'yearly', priority: '0.4' },
  { loc: `${STORE_URL}/shipping`, changefreq: 'yearly', priority: '0.3' },
  { loc: `${STORE_URL}/returns`, changefreq: 'yearly', priority: '0.3' },
  { loc: `${STORE_URL}/privacy`, changefreq: 'yearly', priority: '0.3' },
  { loc: `${STORE_URL}/terms`, changefreq: 'yearly', priority: '0.3' },
];

const products = await fetchProducts();
const productUrls = products.map(p => ({
  loc: `${STORE_URL}/product/${p.slug}`,
  changefreq: 'weekly',
  priority: '0.8',
  lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split('T')[0] : undefined,
}));

if (productUrls.length === 0) {
  console.warn('Sitemap: warning — catalog returned 0 active products (static URLs only).');
}

const allUrls = [...staticUrls, ...productUrls];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    u => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

writeFileSync('public/sitemap.xml', xml, 'utf-8');
console.log(`Sitemap generated: ${allUrls.length} URLs (${productUrls.length} products)`);
