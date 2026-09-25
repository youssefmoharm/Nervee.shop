import { describe, it, expect, vi, afterEach } from 'vitest';

// middleware.ts captures SUPABASE_URL/ANON_KEY at module load, so the env must
// exist before the import below (vi.hoisted runs before imports).
vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
});

const { default: middleware } = await import('../../../middleware');

const SHELL = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>NERVE - Cool but Chic | Contemporary Egyptian Concept Store</title>
  <link rel="canonical" href="https://www.nerveey.shop/" />
  <meta property="og:title" content="NERVE - Cool but Chic | Contemporary Egyptian Concept Store" />
</head>
<body><div id="root"></div></body>
</html>`;

const REST_HEADERS = { 'content-type': 'application/json' };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: REST_HEADERS });
}

describe('middleware head injection (SEO-01)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(rest: (url: string) => Response | undefined) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/index.html')) {
          return new Response(SHELL, { headers: { 'content-type': 'text/html' } });
        }
        const r = rest(url);
        if (r) return r;
        return jsonResponse([]);
      }),
    );
  }

  it('serves the real title + self-canonical for /shop instead of the homepage', async () => {
    stubFetch(() => undefined);

    const res = await middleware(
      new Request('https://www.nerveey.shop/shop?category=T-Shirts&sort=newest'),
    );
    expect(res).toBeTruthy();
    const html = await res!.text();

    expect(html).toContain('<title>Shop | NERVE - Cool but Chic</title>');
    expect(html).toContain('<link rel="canonical" href="https://www.nerveey.shop/shop">');
    expect(html).not.toContain('<link rel="canonical" href="https://www.nerveey.shop/">');
    expect(html).toContain('content="Browse our curated collection');
  });

  it('normalizes trailing slashes so /shop/ canonicalizes to /shop', async () => {
    stubFetch(() => undefined);

    const res = await middleware(new Request('https://www.nerveey.shop/shop/'));
    const html = await res!.text();

    expect(html).toContain('<link rel="canonical" href="https://www.nerveey.shop/shop">');
  });

  it('injects static policy route titles', async () => {
    stubFetch(() => undefined);

    const res = await middleware(new Request('https://www.nerveey.shop/privacy'));
    const html = await res!.text();

    expect(html).toContain('<title>Privacy Policy | NERVE</title>');
    expect(html).toContain('<link rel="canonical" href="https://www.nerveey.shop/privacy">');
  });

  it('falls through for routes it does not manage', async () => {
    stubFetch(() => undefined);

    const res = await middleware(new Request('https://www.nerveey.shop/account/orders'));
    expect(res).toBeUndefined();
  });

  it('still injects product meta when Supabase returns the product', async () => {
    stubFetch(url => {
      if (url.includes('/rest/v1/products?')) {
        return jsonResponse([
          {
            id: 'p1',
            slug: 'nerve-core-tee',
            name: 'Nerve Core Tee',
            description: 'Heavyweight cotton tee.',
            price: 650,
          },
        ]);
      }
      if (url.includes('/rest/v1/product_colors?')) {
        return jsonResponse([{ image: '/images/tee.jpg' }]);
      }
      return undefined;
    });

    const res = await middleware(new Request('https://www.nerveey.shop/product/nerve-core-tee'));
    expect(res).toBeTruthy();
    const html = await res!.text();

    expect(html).toContain('<title>Nerve Core Tee | NERVE</title>');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.nerveey.shop/product/nerve-core-tee">',
    );
    expect(html).toContain('property="og:type" content="product"');
    expect(html).toContain('property="og:image" content="https://www.nerveey.shop/images/tee.jpg"');
  });

  it('injects collection titles from Supabase for /collections/:id', async () => {
    stubFetch(url => {
      if (url.includes('/rest/v1/collections?')) {
        return jsonResponse([
          {
            id: 'essentials',
            name: 'Essentials',
            tagline: 'Core basics',
            description: 'Everyday staples.',
          },
        ]);
      }
      return undefined;
    });

    const res = await middleware(new Request('https://www.nerveey.shop/collections/essentials'));
    expect(res).toBeTruthy();
    const html = await res!.text();

    expect(html).toContain('<title>Essentials | NERVE</title>');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.nerveey.shop/collections/essentials">',
    );
    expect(html).toContain('content="Everyday staples."');
  });
});
