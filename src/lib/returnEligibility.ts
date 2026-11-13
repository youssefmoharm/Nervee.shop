export function returnEligibility(
  order: { status: string; created_at: string; placed_at?: string; delivered_at?: string },
  now = Date.now(),
) {
  const deliveredAge = order.delivered_at ? now - new Date(order.delivered_at).getTime() : Infinity;
  const placedAge = now - new Date(order.placed_at || order.created_at).getTime();
  return {
    canReturn: order.status === 'delivered' && deliveredAge >= 0 && deliveredAge < 7 * 86400000,
    canExchange: order.status === 'delivered' && deliveredAge >= 0 && deliveredAge < 30 * 86400000,
    canCancel:
      ['placed', 'processing'].includes(order.status) && placedAge >= 0 && placedAge < 2 * 3600000,
    cancelTimeLeft: Math.max(0, Math.ceil((2 * 3600000 - placedAge) / 1000)),
  };
}
