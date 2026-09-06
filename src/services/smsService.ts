/**
 * SMS Service for Order Notifications
 *
 * Mock implementation for development
 * In production: integrate with Twilio or AWS SNS
 */

export type SMSStatus = 'placed' | 'shipped' | 'outfordelivery' | 'delivered';

export async function sendOrderSMS(
  phone: string,
  orderId: string,
  status: SMSStatus,
  trackingUrl?: string,
): Promise<void> {
  const messages: Record<SMSStatus, string> = {
    placed: `Order #${orderId} confirmed. Track: ${trackingUrl || 'www.nerve.ey/track'}`,
    shipped: `Your order #${orderId} shipped! Track: ${trackingUrl || 'www.nerve.ey/track'}`,
    outfordelivery: `Order #${orderId} out for delivery. Arriving today!`,
    delivered: `✓ Order #${orderId} delivered!`,
  };

  const message = messages[status];

  // Log to console in development
  console.log(`[SMS to ${phone}]: ${message}`);

  // In production, this would integrate with:
  // - Twilio: https://www.twilio.com
  // - AWS SNS: https://aws.amazon.com/sns/
  // - Local SMS provider for Egypt (e.g., SyberHub)

  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`✓ SMS sent successfully to ${phone}`);
  } catch (error) {
    console.error(`Failed to send SMS to ${phone}:`, error);
    throw new Error(
      `SMS delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Send bulk SMS for order status updates
 */
export async function sendBulkOrderSMS(
  recipients: Array<{ phone: string; orderId: string }>,
  status: SMSStatus,
): Promise<void> {
  const results = await Promise.allSettled(
    recipients.map(r => sendOrderSMS(r.phone, r.orderId, status)),
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  console.log(`Bulk SMS sent: ${successful}/${recipients.length} succeeded`);
}

/**
 * Verify phone number format (Egyptian numbers)
 */
export function isValidEgyptianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, '');
  const phoneRegex = /^(\+20)?01[0-9]{9}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Format phone number to standard format
 */
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
