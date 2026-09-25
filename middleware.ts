/**
 * Vercel Edge Middleware — per-route HTML head injection for crawlers.
 *
 * Scrapers (WhatsApp, Facebook, Telegram, Slack, Googlebot's first pass, etc.)
 * do not run JS, so a pure SPA never exposes per-route titles/canonicals or
 * per-product Open Graph tags. This middleware rewrites the SPA shell with
 * real meta for:
 *   - /product/:slug        (fetched from Supabase)
 *   - /collections/:id      (fetched from Supabase)
 *   - known static routes   (title/description table below)
 *
 * On any error it falls through to the normal SPA rewrite so humans are
 * never broken. Routes not listed here are untouched (index.html defaults).
 */
export const config = {
  matcher: [
    '/product/:path*',
    '/shop',
    '/collections/:path*',
    '/about',
    '/contact',
    '/faq',
    '/shipping',
    '/returns',
    '/privacy',
    '/terms',
    '/size-guide',
  ],
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const SITE = 'https://www.nerveey.shop';
const FALLBACK_IMAGE = `${SITE}/nervee-logo-favicon.png`;

interface RouteSeo {
  title: string;
  description: string;
}

/**
 * Mirrors each page's `useSEO({ title, description })` so the first HTML
 * fetch (crawlers, social scrapers) matches what clients render after
 * hydration (audit SEO-01: every route used to serve the homepage title +
 * canonical=/ in HTML).
 */
const STATIC_SEO: Record<string, RouteSeo> = {
  '/shop': {
    title: 'Shop | NERVE - Cool but Chic',
    description: 'Browse our curated collection of contemporary clothing and lifestyle products.',
  },
  '/collections': {
    title: 'Collections | NERVE Streetwear',
    description:
      'Explore NERVE collections — contemporary Egyptian streetwear and concept-store essentials.',
  },
  '/about': {
    title: 'About Us | NERVE',
    description:
      'NERVE is a contemporary Egyptian concept store built around individuality, movement, and everyday identity.',
  },
  '/contact': {
    title: 'Contact Us | NERVE',
    description: 'Get in touch with the NERVE team — questions, orders and collaborations.',
  },
  '/faq': {
    title: 'FAQ | NERVE - Shipping, Returns & Sizing',
    description: 'Answers about NERVE shipping, returns, exchanges, sizing and payments.',
  },
  '/shipping': {
    title: 'Shipping & Delivery | NERVE',
    description:
      'NERVE shipping and delivery across Egypt — timelines, rates and free-shipping threshold.',
  },
  '/returns': {
    title: 'Returns & Exchanges | NERVE',
    description: 'NERVE returns and exchanges policy — how to start a return and what to expect.',
  },
  '/privacy': {
    title: 'Privacy Policy | NERVE',
    description: 'How NERVE collects, uses and protects your personal information.',
  },
  '/terms': {
    title: 'Terms of Service | NERVE',
    description:
      'The terms and conditions governing your use of nerveey.shop and purchases from NERVE.',
  },
  '/size-guide': {
    title: 'Size Guide | NERVE',
    description: 'Find your NERVE size — measurements and fit guidance for every category.',
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteImage(image: string | null | undefined): string {
  if (!image) return FALLBACK_IMAGE;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return `${SITE}${image}`;
  return `${SITE}/${image}`;
}

function upsertMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const safe = escapeHtml(content);
  const pattern = new RegExp(
    `<meta\\s+(?:${attr}=["']${key.replace(
      /[:]/g,
      '\\:',
    )}["'][^>]*content=["']([^"']*)["']|content=["']([^"']*)["'][^>]*${attr}=["']${key.replace(
      /[:]/g,
      '\\:',
    )}["'])\\s*/?>`,
    'i',
  );
  const tag = `<meta ${attr}="${key}" content="${safe}">`;
  if (pattern.test(html)) {
    return html.replace(pattern, tag);
  }
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

function upsertTitle(html: string, title: string): string {
  const safe = escapeHtml(title);
  if (/<title>[^<]*<\/title>/i.test(html)) {
    return html.replace(/<title>[^<]*<\/title>/i, `<title>${safe}</title>`);
  }
  return html.replace('</head>', `  <title>${safe}</title>\n  </head>`);
}

function upsertCanonical(html: string, href: string): string {
  const safe = escapeHtml(href);
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${safe}">`,
    );
  }
  return html.replace('</head>', `  <link rel="canonical" href="${safe}">\n  </head>`);
}

const SUPABASE_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

async function fetchProduct(slug: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  // products has no image/images columns — primary art lives on product_colors.
  const productUrl = `${SUPABASE_URL}/rest/v1/products?slug=eq.${encodeURIComponent(
    slug,
  )}&is_active=eq.true&select=id,slug,name,description,price`;
  const res = await fetch(productUrl, { headers: SUPABASE_HEADERS });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const product = rows[0] as {
    id: string;
    slug: string | null;
    name: string;
    description?: string | null;
    price?: number | string | null;
    image?: string | null;
    images?: unknown;
    inStock: boolean;
  };

  try {
    const colorUrl = `${SUPABASE_URL}/rest/v1/product_colors?product_id=eq.${encodeURIComponent(
      product.id,
    )}&select=image,hover_image&order=sort_order.asc&limit=1`;
    const colorRes = await fetch(colorUrl, { headers: SUPABASE_HEADERS });
    if (colorRes.ok) {
      const colors = await colorRes.json();
      if (Array.isArray(colors) && colors.length > 0 && colors[0]?.image) {
        product.image = String(colors[0].image);
      }
    }
  } catch {
    // image is optional — fall through to logo fallback
  }

  try {
    // Variant stock for Product JSON-LD availability (SEO-02).
    const stockUrl = `${SUPABASE_URL}/rest/v1/product_inventory?product_id=eq.${encodeURIComponent(
      product.id,
    )}&select=in_stock&limit=100`;
    const stockRes = await fetch(stockUrl, { headers: SUPABASE_HEADERS });
    if (stockRes.ok) {
      const variants = await stockRes.json();
      product.inStock = Array.isArray(variants) && variants.some(v => v?.in_stock === true);
    } else {
      product.inStock = false;
    }
  } catch {
    product.inStock = false;
  }

  return product;
}

async function fetchCollection(id: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/collections?id=eq.${encodeURIComponent(
      id,
    )}&select=id,name,tagline,description`,
    { headers: SUPABASE_HEADERS },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0] as { id: string; name: string; tagline?: string; description?: string };
}

/** Fetch the static SPA shell (real file, not the catch-all rewrite). */
async function fetchShell(url: URL): Promise<string | null> {
  const shellRes = await fetch(new URL('/index.html', url.origin), {
    headers: { accept: 'text/html' },
  });
  if (!shellRes.ok) return null;
  const shellType = shellRes.headers.get('content-type') || '';
  if (!shellType.includes('text/html')) return null;
  return shellRes.text();
}

function shellResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      'x-robots-tag': 'all',
    },
  });
}

/** Generic head injection: title, self-canonical, description + OG/Twitter. */
function injectRouteMeta(html: string, route: string, seo: RouteSeo): string {
  const pageUrl = `${SITE}${route}`;
  let out = html;
  out = upsertTitle(out, seo.title);
  out = upsertCanonical(out, pageUrl);
  out = upsertMeta(out, 'name', 'description', seo.description);
  out = upsertMeta(out, 'property', 'og:title', seo.title);
  out = upsertMeta(out, 'property', 'og:description', seo.description);
  out = upsertMeta(out, 'property', 'og:url', pageUrl);
  out = upsertMeta(out, 'property', 'og:type', 'website');
  out = upsertMeta(out, 'name', 'twitter:title', seo.title);
  out = upsertMeta(out, 'name', 'twitter:description', seo.description);
  return out;
}

/** Upsert a JSON-LD script by @type (replaces an existing same-type block). */
function upsertJsonLd(html: string, data: Record<string, unknown>): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const script = `<script type="application/ld+json">${json}</script>`;
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as { '@type'?: string };
      if (parsed && parsed['@type'] === data['@type']) {
        return html.replace(match[0], script);
      }
    } catch {
      // malformed existing block — leave it alone
    }
  }
  return html.replace('</head>', `  ${script}\n  </head>`);
}

function injectProductMeta(
  html: string,
  product: Awaited<ReturnType<typeof fetchProduct>>,
): string {
  if (!product) return html;
  const key = product.slug || product.id;
  const pageUrl = `${SITE}/product/${key}`;
  const title = `${product.name} | NERVE`;
  const description =
    (product.description && String(product.description).slice(0, 300)) ||
    `${product.name} — shop at NERVE. Cash on delivery across Egypt.`;
  let image = absoluteImage(product.image);
  if (!product.image && Array.isArray(product.images) && product.images.length > 0) {
    const first = product.images[0];
    if (typeof first === 'string') image = absoluteImage(first);
    else if (first && typeof first === 'object' && 'image' in first) {
      image = absoluteImage(String((first as { image?: string }).image || ''));
    }
  }

  let out = html;
  out = upsertTitle(out, title);
  out = upsertCanonical(out, pageUrl);
  out = upsertMeta(out, 'name', 'description', description);
  out = upsertMeta(out, 'property', 'og:title', title);
  out = upsertMeta(out, 'property', 'og:description', description);
  out = upsertMeta(out, 'property', 'og:url', pageUrl);
  out = upsertMeta(out, 'property', 'og:type', 'product');
  out = upsertMeta(out, 'property', 'og:image', image);
  out = upsertMeta(out, 'name', 'twitter:card', 'summary_large_image');
  out = upsertMeta(out, 'name', 'twitter:title', title);
  out = upsertMeta(out, 'name', 'twitter:description', description);
  out = upsertMeta(out, 'name', 'twitter:image', image);

  // Product JSON-LD for first-fetch crawlers (SEO-02). After hydration the
  // client rewrites the same @type block with live stock/rating data — the
  // upsert-by-@type keeps exactly one Product schema in the DOM.
  out = upsertJsonLd(out, {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    image,
    url: pageUrl,
    brand: { '@type': 'Brand', name: 'NERVE' },
    offers: {
      '@type': 'Offer',
      price: String(product.price ?? ''),
      priceCurrency: 'EGP',
      url: pageUrl,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  });

  return out;
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  try {
    const url = new URL(request.url);
    // Normalize: '/shop/' and '/shop' are the same page (canonical parity).
    const route = url.pathname.replace(/\/+$/, '') || '/';

    let html: string | null = null;

    if (route.startsWith('/product/')) {
      const slug = decodeURIComponent(route.slice('/product/'.length));
      if (!slug || slug.includes('/')) return;
      const product = await fetchProduct(slug);
      if (!product) return; // unknown product → normal SPA
      html = await fetchShell(url);
      if (html === null) return;
      html = injectProductMeta(html, product);
    } else if (route.startsWith('/collections/')) {
      const id = decodeURIComponent(route.slice('/collections/'.length));
      if (!id || id.includes('/')) return;
      const collection = await fetchCollection(id);
      if (!collection) return; // unknown collection → normal SPA
      html = await fetchShell(url);
      if (html === null) return;
      html = injectRouteMeta(html, route, {
        title: `${collection.name} | NERVE`,
        description: collection.description || collection.tagline || 'Browse the NERVE collection.',
      });
    } else {
      const seo = STATIC_SEO[route];
      if (!seo) return; // unmapped route → normal SPA
      html = await fetchShell(url);
      if (html === null) return;
      html = injectRouteMeta(html, route, seo);
    }

    return shellResponse(html);
  } catch {
    // Never break human navigation — fall through to SPA rewrite.
    return;
  }
}
