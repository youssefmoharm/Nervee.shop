export type DeliveryMethod = 'standard' | 'express'

export function estimateShippingCost(subtotal: number, deliveryMethod: DeliveryMethod) {
  if (deliveryMethod === 'express') return 200
  return subtotal > 2000 ? 0 : 100
}

export function getDeliveryEstimateLabel(deliveryMethod: DeliveryMethod, subtotal: number) {
  const shipping = estimateShippingCost(subtotal, deliveryMethod)
  const window = deliveryMethod === 'express' ? '1–2 business days' : '2–5 business days'
  return shipping === 0 ? `${window} · free shipping` : `${window} · EGP ${shipping} shipping`
}

export function getCheckoutSummary(subtotal: number, deliveryMethod: DeliveryMethod, discountAmount = 0) {
  const shipping = estimateShippingCost(subtotal, deliveryMethod)
  const total = Math.max(0, subtotal + shipping - discountAmount)

  return { shipping, total }
}
