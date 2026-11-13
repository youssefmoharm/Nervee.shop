import { orderConfirmedEmail, sendEmail } from './email.ts';

// A lease prevents concurrent delivery; provider idempotency covers a lost acknowledgement.
export async function deliverOrderNotifications(
  supabase: any,
  orderId?: string,
  mailer = sendEmail,
) {
  const { data: jobs, error } = await supabase.rpc('claim_order_notifications', {
    p_order_id: orderId ?? null,
  });
  if (error) throw error;
  let failed = 0;
  await Promise.all(
    (jobs ?? []).map(async (job: { order_id: string; lease_id: string; attempts: number }) => {
      try {
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', job.order_id)
          .single();
        if (orderError) throw orderError;
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', job.order_id);
        if (itemsError) throw itemsError;
        let link: string | undefined;
        if (!order.customer_id) {
          const { data: guest, error: guestError } = await supabase
            .from('guest_orders')
            .select('verification_token')
            .eq('order_id', job.order_id)
            .single();
          if (guestError) throw guestError;
          const query = new URLSearchParams({
            email: order.email,
            orderNumber: order.order_number,
            token: guest.verification_token,
          });
          link = `${Deno.env.get('STORE_URL') || 'https://www.nerveey.shop'}/track-order?${query}`;
        }
        const result = await mailer(
          order.email,
          `Order Confirmed — #${order.order_number}`,
          orderConfirmedEmail(order, items ?? [], link),
          'order_confirmation',
          `order-confirmation/${order.id}`,
        );
        if (!result.success) throw new Error(result.error || 'Delivery failed');
        const { error: saveError } = await supabase
          .from('order_notification_outbox')
          .update({ delivered_at: new Date().toISOString(), last_error: null })
          .eq('order_id', job.order_id)
          .eq('lease_id', job.lease_id);
        if (saveError) throw saveError;
        const { error: recoveredError } = await supabase.rpc('mark_cart_abandonment_recovered', {
          p_customer_email: order.email,
        });
        if (recoveredError)
          console.error('Could not mark abandoned cart recovered', recoveredError.code);
      } catch (error) {
        failed++;
        // Do not persist provider payloads or customer data in operational errors.
        console.error('Order notification requires retry', job.order_id);
        await supabase
          .from('order_notification_outbox')
          .update({
            last_error: 'Delivery failed; check email configuration and worker logs',
            available_at: new Date(
              Date.now() + Math.min(3600, 60 * 2 ** Math.min(job.attempts, 6)) * 1000,
            ).toISOString(),
          })
          .eq('order_id', job.order_id)
          .eq('lease_id', job.lease_id);
      }
    }),
  );
  return { processed: jobs?.length ?? 0, failed };
}
