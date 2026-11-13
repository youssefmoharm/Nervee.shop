import { deliverOrderNotifications } from './order-notifications.ts';

function fixture(fail = false) {
  const writes: Array<{ table: string; value: Record<string, unknown> }> = [];
  const client = {
    rpc: (name: string) =>
      name === 'claim_order_notifications'
        ? Promise.resolve({
            data: [{ order_id: 'order-1', lease_id: 'lease-1', attempts: 1 }],
            error: null,
          })
        : Promise.resolve({ error: null }),
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        single: () =>
          Promise.resolve({
            data:
              table === 'orders'
                ? {
                    id: 'order-1',
                    customer_id: 'buyer',
                    order_number: 'NRV-123456',
                    email: 'buyer@example.test',
                    first_name: 'Buyer',
                    address: '15 Test Street',
                    city: 'Cairo',
                    governorate: 'Cairo',
                    total: 750,
                    subtotal: 650,
                    shipping_cost: 100,
                    discount_amount: 0,
                  }
                : {},
            error: null,
          }),
        update(value: Record<string, unknown>) {
          writes.push({ table, value });
          return query;
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  const mailer = () =>
    Promise.resolve({ success: !fail, error: fail ? 'Provider unavailable' : undefined });
  return { client, writes, mailer };
}
Deno.test('notification success acknowledges delivery', async () => {
  const { client, writes, mailer } = fixture();
  const result = await deliverOrderNotifications(client, 'order-1', mailer);
  if (result.failed !== 0 || !writes.some(w => w.value.delivered_at))
    throw new Error('Delivery not acknowledged');
});
Deno.test('provider failure retains a retryable job without acknowledgement', async () => {
  const { client, writes, mailer } = fixture(true);
  const result = await deliverOrderNotifications(client, 'order-1', mailer);
  if (result.failed !== 1 || writes.some(w => w.value.delivered_at))
    throw new Error('Failed delivery acknowledged');
  if (!writes.some(w => w.value.available_at && w.value.last_error))
    throw new Error('Retry not scheduled');
});
