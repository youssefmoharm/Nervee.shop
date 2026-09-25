import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * PERF-05: guest wishlist merge must batch - one wishlists upsert plus one
 * wishlist_items upsert for N items, instead of 2 queries per item.
 */
const { calls } = vi.hoisted(() => ({
  calls: { from: [] as string[], upserts: [] as Array<{ table: string; rows: unknown }> },
}));

vi.mock('../../lib/supabase', () => {
  interface MockBuilder {
    upsert(rows: unknown): MockBuilder;
    select(): MockBuilder;
    eq(): MockBuilder;
    delete(): MockBuilder;
    maybeSingle(): Promise<{ data: unknown; error: null }>;
    single(): Promise<{ data: unknown; error: null }>;
    then(
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ): Promise<unknown>;
  }
  const makeBuilder = (table: string): MockBuilder => {
    const builder: MockBuilder = {
      upsert: rows => {
        calls.upserts.push({ table, rows });
        return builder;
      },
      select: () => builder,
      eq: () => builder,
      delete: () => builder,
      maybeSingle: async () => ({ data: { id: 'wl-1' }, error: null }),
      single: async () => ({ data: { id: 'wl-1' }, error: null }),
      then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    return builder;
  };
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
      from: (table: string) => {
        calls.from.push(table);
        return makeBuilder(table);
      },
    },
  };
});

vi.mock('../../lib/sentry', () => ({ logError: vi.fn() }));

import { wishlistService } from '../../services/wishlistService';

describe('wishlistService.mergeGuestWishlist', () => {
  beforeEach(() => {
    calls.from.length = 0;
    calls.upserts.length = 0;
  });

  it('batches N items into 1 wishlist upsert + 1 items upsert', async () => {
    const items = ['p1', 'p2', 'p3', 'p4', 'p5'].map(id => ({
      productId: id,
      name: `Product ${id}`,
      slug: `product-${id}`,
      image: '',
      price: 100,
    }));

    await wishlistService.mergeGuestWishlist(items);

    expect(calls.from).toEqual(['wishlists', 'wishlist_items']);
    expect(calls.upserts).toHaveLength(2);
    expect(calls.upserts[0].table).toBe('wishlists');
    expect(calls.upserts[1].table).toBe('wishlist_items');
    expect(calls.upserts[1].rows).toHaveLength(5);
    expect(calls.upserts[1].rows).toEqual(
      items.map(item => ({ wishlist_id: 'wl-1', product_id: item.productId })),
    );
  });

  it('does nothing for an empty guest wishlist', async () => {
    await wishlistService.mergeGuestWishlist([]);
    expect(calls.from).toEqual([]);
    expect(calls.upserts).toEqual([]);
  });
});
