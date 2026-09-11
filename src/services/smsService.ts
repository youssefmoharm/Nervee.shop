/**
 * SMS Service for Order Notifications
 *
 * Disabled — no SMS provider is configured. Calls are no-ops.
 * To enable: integrate with Twilio, AWS SNS, or a local Egyptian provider
 * (e.g., SyberHub) and replace the function bodies below.
 */

export type SMSStatus = 'placed' | 'shipped' | 'outfordelivery' | 'delivered';

export async function sendOrderSMS(
  _phone: string,
  _orderId: string,
  _status: SMSStatus,
  _trackingUrl?: string,
): Promise<void> {
  // No-op: SMS provider not configured
}

/**
 * Send bulk SMS for order status updates
 */
export async function sendBulkOrderSMS(
  _recipients: Array<{ phone: string; orderId: string }>,
  _status: SMSStatus,
): Promise<void> {
  // No-op: SMS provider not configured
}

export function isValidEgyptianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '');
  const normalized = cleaned.replace(/^(\+20|0020)/, '');
  return /^01[0-2,5][0-9]{8}$/.test(normalized);
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('20')) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('01')) {
    return '+20' + cleaned;
  }
  return '+20' + cleaned;
}
