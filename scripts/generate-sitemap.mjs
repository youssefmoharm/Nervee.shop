#!/usr/bin/env node
/**
 * Generate public/sitemap.xml with dynamic product URLs.
 * Run at build time: node scripts/generate-sitemap.mjs
 * Requires VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (or falls back to prod).
 */
import { writeFileSync } from 'node:fs';

const STORE_URL = process.env.STORE_URL || process.env.VITE_APP_URL || 'https://www.nerveey.shop';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gfmxvvjqlhrnmidutjwx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6zkBS2alnvDPd0pSqVJBkQ_76y60UBW';

async function fetchProducts() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=slug,updated_at&is_active=eq.true`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const staticUrls = [
  { loc: `${STORE_URL}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${STORE_URL}/shop`, changefreq: 'daily', priority: '0.9' },
  { loc: `${STORE_URL}/collections`, changefreq: 'weekly', priority: '0.8' },
  { loc: `${STORE_URL}/about`, changefreq: 'monthly', priority: '0.5' },
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

const allUrls = [...staticUrls, ...productUrls];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

writeFileSync('public/sitemap.xml', xml, 'utf-8');
console.log(`Sitemap generated: ${allUrls.length} URLs (${productUrls.length} products)`);
