import { describe, it, expect, beforeEach } from 'vitest';
import { addStructuredData } from '../../lib/seo';

const scripts = () => Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

describe('addStructuredData type-level dedupe (SEO-02)', () => {
  beforeEach(() => {
    scripts().forEach(s => s.remove());
  });

  it('replaces an existing same-@type block instead of duplicating it', () => {
    addStructuredData({ '@type': 'Product', name: 'Edge copy' });
    addStructuredData({ '@type': 'Product', name: 'Client copy' });

    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].textContent).toContain('Client copy');
  });

  it('keeps blocks of different types side by side', () => {
    addStructuredData({ '@type': 'Organization', name: 'NERVE' });
    addStructuredData({ '@type': 'Product', name: 'Tee' });

    expect(scripts()).toHaveLength(2);
  });

  it('returns a disposer that removes its own script', () => {
    const dispose = addStructuredData({ '@type': 'BreadcrumbList', itemListElement: [] });
    expect(scripts()).toHaveLength(1);
    dispose();
    expect(scripts()).toHaveLength(0);
  });
});
