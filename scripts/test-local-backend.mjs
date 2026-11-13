// Destructive fixtures are confined to the disposable local Supabase stack.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
const url = process.env.API_URL;
if (!url) throw new Error('Missing API_URL');
const host = new URL(url).hostname;
const local = ['127.0.0.1', 'localhost'].includes(host);
const staging =
  process.env.ALLOW_STAGING_WRITES === '1' &&
  !!process.env.STAGING_PROJECT_REF &&
  host === `${process.env.STAGING_PROJECT_REF}.supabase.co`;
if (!local && !staging)
  throw new Error('Only disposable local or explicitly configured staging Supabase is supported');
for (const name of ['ANON_KEY', 'SERVICE_ROLE_KEY'])
  if (!process.env[name]) throw new Error(`Missing ${name}`);
const admin = createClient(url, process.env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(url, process.env.ANON_KEY, { auth: { persistSession: false } });
const id = `smoke-${randomUUID()}`;
let userId;
const checked = async query => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};
const body = {
  email: `${id}@example.test`,
  firstName: 'Local',
  lastName: 'Buyer',
  phone: '01012345678',
  address: '15 Test Street, Cairo',
  city: 'Cairo',
  governorate: 'Cairo',
  deliveryMethod: 'standard',
  paymentMethod: 'cod',
  idempotencyKey: randomUUID(),
  items: [{ productId: id, color: 'Navy', size: 'M', quantity: 1 }],
};
try {
  await checked(
    admin.from('products').insert({
      id,
      slug: id,
      name: 'Local smoke tee',
      category: 'T-Shirts',
      price: 650,
      description: 'Smoke fixture',
      material: 'Cotton',
      care: [],
    }),
  );
  await checked(
    admin
      .from('product_inventory')
      .insert({ product_id: id, size: 'M', stock_quantity: 5, in_stock: true }),
  );
  const placed = await checked(anon.functions.invoke('create-order', { body }));
  if (!placed?.order?.id) throw new Error('Guest checkout did not create an order');
  const retry = await checked(anon.functions.invoke('create-order', { body }));
  if (retry.order.id !== placed.order.id) throw new Error('Lost-response retry duplicated order');
  const guest = await checked(
    admin
      .from('guest_orders')
      .select('verification_token')
      .eq('order_id', placed.order.id)
      .single(),
  );
  const tracked = await checked(
    anon.functions.invoke('verify-guest-order', {
      body: {
        email: body.email,
        orderNumber: placed.order.order_number,
        token: guest.verification_token,
      },
    }),
  );
  if (tracked.order.id !== placed.order.id) throw new Error('Guest tracking failed');
  const password = randomUUID() + 'Aa1!';
  const user = await checked(
    admin.auth.admin.createUser({ email: `account-${body.email}`, password, email_confirm: true }),
  );
  userId = user.user.id;
  await checked(anon.auth.signInWithPassword({ email: `account-${body.email}`, password }));
  const signed = await checked(
    anon.functions.invoke('create-order', {
      body: { ...body, email: `account-${body.email}`, idempotencyKey: randomUUID() },
    }),
  );
  const order = await checked(
    admin.from('orders').select('customer_id').eq('id', signed.order.id).single(),
  );
  if (order.customer_id !== userId) throw new Error('Signed-in order ownership incorrect');
  const inventory = await checked(
    admin.from('product_inventory').select('stock_quantity').eq('product_id', id).single(),
  );
  if (inventory.stock_quantity !== 3) throw new Error('Inventory did not reflect two purchases');
  console.log(
    'PASS: guest checkout, idempotent retry, guest tracking, signed-in ownership and inventory',
  );
} finally {
  await checked(admin.from('guest_orders').delete().like('email', `%${id}%`));
  await checked(admin.from('orders').delete().like('email', `%${id}%`));
  if (userId) await checked(admin.auth.admin.deleteUser(userId));
  await checked(admin.from('products').delete().eq('id', id));
}
