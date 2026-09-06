/**
 * Secure logging for Edge Functions
 *
 * NEVER log:
 * - Deno.env values (secrets)
 * - Error objects that might contain environment details
 * - API responses containing sensitive data
 * - JWT tokens
 * - Database connection strings
 *
 * ALWAYS:
 * - Log only error codes and generic messages
 * - Filter secrets before logging
 * - Use redacted() for sensitive values
 */

const SECRETS_TO_REDACT = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_GEMINI_API_KEY',
  'PAYMOB_API_KEY',
  'PAYMOB_HMAC_SECRET',
  'CRON_SECRET',
  'STRIPE_API_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'TWILIO_AUTH_TOKEN',
  'SENDGRID_API_KEY',
];

/**
 * Redact secrets from a string before logging
 */
export function redactSecrets(text: string | unknown): string {
  if (!text || typeof text !== 'string') return String(text);

  let result = text;
  SECRETS_TO_REDACT.forEach(secret => {
    // Match environment variable values (rough pattern)
    result = result.replace(
      new RegExp(`(Bearer\\s+)?[A-Za-z0-9_-]{20,}`, 'g'),
      '[REDACTED]'
    );
  });
  return result;
}

/**
 * Safe error logging - never leak internal details
 */
export function logError(context: string, error: unknown) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const safeMsg = redactSecrets(errorMsg);

  // Log to Deno runtime (visible in Supabase logs, but monitored)
  console.error(`[ERROR] ${context}: ${safeMsg}`);

  // In production, integrate with Sentry or external monitoring
  // sentry.captureException(new Error(context), { level: 'error' });
}

/**
 * Safe info logging
 */
export function logInfo(context: string, message: string, data?: unknown) {
  let safeData = '';
  if (data) {
    try {
      const redacted = typeof data === 'string' ? redactSecrets(data) : JSON.stringify(data);
      safeData = ` | ${redacted.substring(0, 200)}`; // Limit length
    } catch {
      safeData = ' | [data redacted]';
    }
  }
  console.log(`[INFO] ${context}: ${message}${safeData}`);
}

/**
 * Safe warn logging
 */
export function logWarn(context: string, message: string) {
  console.warn(`[WARN] ${context}: ${message}`);
}

/**
 * Filter sensitive fields from objects before logging
 */
export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('api')
    ) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 100) {
      redacted[key] = `${value.substring(0, 50)}...`;
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
