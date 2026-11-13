import { checkOperationsHealth } from './operations-health.ts';
Deno.test('operations health returns queue and refund balances', async () => {
  const health = await checkOperationsHealth({
    rpc: async () => ({
      data: [{ overdue_notifications: 0, failed_notifications: 0, outstanding_cod_refunds: 650 }],
      error: null,
    }),
  });
  if (health.outstanding_cod_refunds !== 650) throw new Error('Refund obligation was lost');
});
Deno.test('operations health propagates a database outage', async () => {
  let failed = false;
  try {
    await checkOperationsHealth({
      rpc: async () => ({ data: null, error: new Error('Unavailable') }),
    });
  } catch {
    failed = true;
  }
  if (!failed) throw new Error('Unavailable database appeared healthy');
});
