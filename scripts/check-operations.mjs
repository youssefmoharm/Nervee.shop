const url = process.env.OPS_WORKER_URL;
const secret = process.env.CRON_SECRET;
if (!url || !secret) throw new Error('Configure OPS_WORKER_URL and CRON_SECRET');
if (new URL(url).protocol !== 'https:') throw new Error('HTTPS worker endpoint required');
const response = await fetch(url, {
  method: 'POST',
  headers: { 'x-cron-secret': secret, 'Content-Type': 'application/json' },
  body: '{}',
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Operations worker returned HTTP ${response.status}`);
const data = await response.json();
if (!data.health || typeof data.health.overdue_notifications !== 'number')
  throw new Error('Worker returned an invalid health response');
console.log(
  JSON.stringify({ processed: data.processed, failed: data.failed, health: data.health }),
);
if (data.failed || data.health.overdue_notifications || data.health.failed_notifications)
  process.exit(1);
