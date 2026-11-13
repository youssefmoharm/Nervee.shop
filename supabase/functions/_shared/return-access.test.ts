import { canRequestReturn } from './return-access.ts';
Deno.test('return ownership never accepts an arbitrary signed-in user for a guest order', () => {
  const guest = { customer_id: null, email: 'owner@example.test' };
  if (canRequestReturn(guest, 'intruder', 'other@example.test', false))
    throw new Error('Guest IDOR');
  if (canRequestReturn(guest, null, undefined, false)) throw new Error('Anonymous IDOR');
  if (!canRequestReturn(guest, 'owner', 'OWNER@example.test', false))
    throw new Error('Verified email rejected');
  if (!canRequestReturn(guest, null, undefined, true)) throw new Error('Guest token rejected');
});
Deno.test('account orders require the actual account owner', () => {
  const order = { customer_id: 'owner', email: 'owner@example.test' };
  if (canRequestReturn(order, 'intruder', 'owner@example.test', true))
    throw new Error('Account IDOR');
  if (!canRequestReturn(order, 'owner', 'owner@example.test', false))
    throw new Error('Account owner rejected');
});
