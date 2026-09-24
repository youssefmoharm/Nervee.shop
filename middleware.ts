/**
 * Vercel Edge Middleware — product page OG/meta injection for social scrapers.
 *
 * Scrapers (WhatsApp, Facebook, Telegram, Slack, etc.) do not run JS, so a
 * pure SPA never exposes per-product Open Graph tags. This middleware rewrites
 * the SPA shell with real product meta for /product/:slug only when the product
 * exists. On any error it falls through to the normal SPA rewrite so humans
 * are never broken.
 */
export const config = {
  matcher: '/product/:path*',
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.your_removed_credential_here || '';

const SITE = 'https://www.nerveey.shop';
const FALLBACK_IMAGE = `${SITE}/nervee-logo-favicon.png`;

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

async function fetchProduct(slug: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/products?slug=eq.${encodeURIComponent(
    slug,
  )}&is_active=eq.true&select=id,slug,name,description,price,image,images`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0] as {
    id: string;
    slug: string | null;
    name: string;
    description?: string | null;
    price?: number | string | null;
    image?: string | null;
    images?: unknown;
  };
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

  const price = product.price != null ? Number(product.price) : null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': pageUrl,
    name: product.name,
    description,
    image,
    url: pageUrl,
    ...(price != null && Number.isFinite(price)
      ? {
          offers: {
            '@type': 'Offer',
            price: String(price),
            priceCurrency: 'EGP',
            availability: 'https://schema.org/InStock',
            url: pageUrl,
          },
        }
      : {}),
  };
  const scriptTag = `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(
    /</g,
    '\\u003c',
  )}</script>`;
  // Replace the static OnlineStore JSON-LD if present, else append before </head>.
  if (
    /<script type="application\/ld\+json">[\s\S]*?"@type"\s*:\s*"OnlineStore"[\s\S]*?<\/script>/i.test(
      out,
    )
  ) {
    out = out.replace(
      /<script type="application\/ld\+json">[\s\S]*?"@type"\s*:\s*"OnlineStore"[\s\S]*?<\/script>/i,
      scriptTag,
    );
  } else {
    out = out.replace('</head>', `  ${scriptTag}\n  </head>`);
  }
  return out;
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  try {
    const url = new URL(request.url);
    const slug = decodeURIComponent(url.pathname.replace(/^\/product\//, '').replace(/\/$/, ''));
    if (!slug || slug.includes('/')) return;

    const product = await fetchProduct(slug);
    if (!product) return; // unknown product → normal SPA

    // Fetch the static SPA shell (real file, not the catch-all rewrite).
    const shellRes = await fetch(new URL('/index.html', url.origin), {
      headers: { accept: 'text/html' },
    });
    if (!shellRes.ok) return;
    const shellType = shellRes.headers.get('content-type') || '';
    if (!shellType.includes('text/html')) return;

    const html = await shellRes.text();
    const injected = injectProductMeta(html, product);
    return new Response(injected, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
        'x-robots-tag': 'all',
      },
    });
  } catch {
    // Never break human navigation — fall through to SPA rewrite.
    return;
  }
}
