import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionsHttpError } from '@supabase/supabase-js';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke } },
}));
const info = {
  email: 'buyer@example.test',
  firstName: 'Buyer',
  lastName: 'Test',
  phone: '01012345678',
  address: '15 Test Street',
  city: 'Cairo',
  governorate: 'Cairo',
  deliveryMethod: 'standard' as const,
  paymentMethod: 'cod' as const,
};
const lines = [
  {
    productId: 'p1',
    color: 'Navy',
    size: 'M',
    quantity: 1,
    image: '/p.jpg',
    name: 'Tee',
    price: 650,
  },
] as Parameters<typeof import('../../services/orderService').orderService.placeOrder>[1];
describe('checkout retry recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    invoke.mockReset();
    vi.resetModules();
  });
  it('preserves the key after a lost response and module reload, changes it for a new payload', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Network failed') });
    let service = (await import('../../services/orderService')).orderService;
    await service.placeOrder(info, lines);
    const first = invoke.mock.calls[0][1].body.idempotencyKey;
    vi.resetModules();
    service = (await import('../../services/orderService')).orderService;
    await service.placeOrder(info, lines);
    expect(invoke.mock.calls[1][1].body.idempotencyKey).toBe(first);
    await service.placeOrder({ ...info, address: 'Different address' }, lines);
    expect(invoke.mock.calls[2][1].body.idempotencyKey).not.toBe(first);
  });
  it('shows structured non-2xx validation errors', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(
          JSON.stringify({ error: 'Size M out of stock', details: ['Choose another size'] }),
        ),
      ),
    });
    const { orderService } = await import('../../services/orderService');
    expect(await orderService.placeOrder(info, lines)).toMatchObject({
      error: 'Size M out of stock',
      details: ['Choose another size'],
    });
  });
  it('clears the persisted attempt after success', async () => {
    invoke.mockResolvedValue({ data: { order: { id: 'order-1' } }, error: null });
    const { orderService } = await import('../../services/orderService');
    await orderService.placeOrder(info, lines);
    expect(localStorage.getItem('nerve.checkout-attempt')).toBeNull();
  });
});
