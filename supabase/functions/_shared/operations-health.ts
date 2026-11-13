import { sendToSentry } from './monitoring.ts';
export async function checkOperationsHealth(client: any) {
  const { data, error } = await client.rpc('operations_health');
  if (error) throw error;
  const health = Array.isArray(data) ? data[0] : data;
  if (health.overdue_notifications > 0 || health.failed_notifications > 0) {
    await sendToSentry({
      type: 'error',
      category: 'ORDER_NOTIFICATION_BACKLOG',
      message: 'Order confirmations require attention',
      data: health,
    });
  }
  return health;
}
