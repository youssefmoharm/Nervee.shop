import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { checkOperationsHealth } from '../_shared/operations-health.ts';
import { deliverOrderNotifications } from '../_shared/order-notifications.ts';
serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret)
    return new Response('Unauthorized', { status: 401 });
  try {
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const delivery = await deliverOrderNotifications(client);
    const health = await checkOperationsHealth(client);
    return Response.json({ ...delivery, health });
  } catch {
    return Response.json({ error: 'Worker unavailable' }, { status: 503 });
  }
});
