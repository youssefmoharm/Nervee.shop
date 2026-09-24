import {
  EXPRESS_SHIPPING_COST,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_COST,
} from './storeConfig';
import { formatEGP } from './format';

export type DeliveryMethod = 'standard' | 'express';

export const EGYPT_VAT_RATE = 0.14; // 14% VAT

export function estimateShippingCost(subtotal: number, deliveryMethod: DeliveryMethod) {
  if (deliveryMethod === 'express') return EXPRESS_SHIPPING_COST;
  if (subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return STANDARD_SHIPPING_COST;
}

export function getDeliveryEstimateLabel(deliveryMethod: DeliveryMethod, subtotal: number) {
  const shipping = estimateShippingCost(subtotal, deliveryMethod);
  const window = deliveryMethod === 'express' ? '1–2 business days' : '2–5 business days';
  return shipping === 0
    ? `${window} · free shipping`
    : `${window} · ${formatEGP(shipping)} shipping`;
}

export function getCheckoutSummary(
  subtotal: number,
  deliveryMethod: DeliveryMethod,
  discountAmount = 0,
) {
  const shipping = estimateShippingCost(subtotal, deliveryMethod);
  const total = Math.max(0, subtotal + shipping - discountAmount);
  const vatAmount = Math.round((subtotal * EGYPT_VAT_RATE) / (1 + EGYPT_VAT_RATE));

  return { shipping, total, vatAmount };
}
