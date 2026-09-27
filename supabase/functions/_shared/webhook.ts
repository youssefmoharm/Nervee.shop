/**
 * Webhook signature verification utilities for secure webhook handling
 *
 * Provides HMAC signature verification to prevent:
 * - Webhook spoofing
 * - Replay attacks
 * - Unauthorized data manipulation
 */

import { createHmac } from 'https://deno.land/std@0.224.0/hash/mod.ts';

/**
 * Webhook signature header names by provider
 */
export const WEBHOOK_SIGNATURE_HEADERS: Record<string, string> = {
  stripe: 'stripe-signature',
  paymob: 'x-paymob-signature',
  generic: 'x-signature',
};

/**
 * Verify webhook signature using HMAC-SHA256
 *
 * @param payload - Raw webhook payload (must be string)
 * @param signature - Signature from webhook header
 * @param secret - Webhook secret (same as configured in provider dashboard)
 * @param headerName - Name of the header containing the signature
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
  headerName: string = 'x-signature',
): boolean {
  if (!signature) {
    return false;
  }

  // Expected signature format: algorithm=hash
  // Example: sha256=abc123...
  const parts = signature.split('=');
  if (parts.length !== 2) {
    return false;
  }

  const [algorithm, expectedHash] = parts;

  // Only accept SHA256 (or no algorithm specified for legacy compatibility)
  if (algorithm !== 'sha256' && algorithm !== '') {
    return false;
  }

  // Compute expected hash
  const hmac = createHmac('SHA256', secret);
  hmac.update(payload);
  const computedHash = hmac.digest('hex');

  // Constant-time comparison to prevent timing attacks
  return constantTimeCompare(computedHash, expectedHash);
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal, false otherwise
 */
export function constantTimeCompare(a: string, b: string): boolean {
  // If lengths differ, they can't be equal
  // But we still need to compute the hash to prevent length-based timing attacks
  const lengthA = a.length;
  const lengthB = b.length;

  // Always compare the maximum length to prevent timing attacks based on length
  const maxLength = Math.max(lengthA, lengthB);
  let result = lengthA ^ lengthB; // XOR - will be 0 if lengths are equal

  // Compare each character
  for (let i = 0; i < maxLength; i++) {
    const charA = i < lengthA ? a.charCodeAt(i) : 0;
    const charB = i < lengthB ? b.charCodeAt(i) : 0;
    result |= charA ^ charB; // XOR - will be non-zero if chars differ
  }

  // Return true only if result is 0 (all comparisons matched)
  return result === 0;
}

/**
 * Parse webhook payload from request
 *
 * @param request - The incoming webhook request
 * @returns The raw payload string
 */
export async function parseWebhookPayload(request: Request): Promise<string> {
  const contentType = request.headers.get('content-type') || '';

  // For JSON payloads
  if (contentType.includes('application/json')) {
    return await request.text();
  }

  // For form-encoded payloads
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    const payload: Record<string, string> = {};
    formData.forEach((value, key) => {
      payload[key] = String(value);
    });
    return JSON.stringify(payload);
  }

  // Default: return raw text
  return await request.text();
}

/**
 * Extract signature from webhook request header
 *
 * @param request - The incoming webhook request
 * @param provider - Webhook provider ('stripe', 'paymob', or custom)
 * @returns The signature string or null if not found
 */
export function extractWebhookSignature(
  request: Request,
  provider: string = 'generic',
): string | null {
  const headerName = WEBHOOK_SIGNATURE_HEADERS[provider] || WEBHOOK_SIGNATURE_HEADERS.generic;
  return request.headers.get(headerName);
}

/**
 * Log webhook event safely (redacts sensitive data)
 *
 * @param event - Event name/type
 * @param data - Event data to log
 * @param requestId - Optional request ID for tracing
 */
export function logWebhookEvent(
  event: string,
  data?: Record<string, unknown>,
  requestId?: string,
): void {
  // Redact sensitive fields before logging
  const sensitiveFields = ['secret', 'token', 'key', 'password', 'signature', 'authorization'];

  let safeData = '';
  if (data) {
    try {
      const redacted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = value;
        }
      }
      safeData = JSON.stringify(redacted);
    } catch {
      safeData = '[data redacted]';
    }
  }

  const prefix = requestId ? `[${requestId}]` : '';
  console.log(`${prefix}[WEBHOOK] ${event}${safeData ? ` ${safeData}` : ''}`);
}

/**
 * Webhook verification result
 */
export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  signature?: string;
}

/**
 * Verify webhook with comprehensive error handling
 *
 * @param request - The incoming webhook request
 * @param secret - Webhook secret
 * @param provider - Webhook provider
 * @returns Verification result
 */
export async function verifyWebhook(
  request: Request,
  secret: string,
  provider: string = 'generic',
): Promise<WebhookVerificationResult> {
  try {
    // Parse payload
    const payload = await parseWebhookPayload(request);

    // Extract signature
    const signature = extractWebhookSignature(request, provider);

    if (!signature) {
      return {
        valid: false,
        error: 'Missing webhook signature',
      };
    }

    // Verify signature
    const isValid = verifyWebhookSignature(payload, signature, secret, provider);

    if (!isValid) {
      return {
        valid: false,
        error: 'Invalid webhook signature',
      };
    }

    return { valid: true, signature };
  } catch (error) {
    console.error('[WEBHOOK] Verification error:', error);
    return {
      valid: false,
      error: 'Webhook verification failed',
    };
  }
}
