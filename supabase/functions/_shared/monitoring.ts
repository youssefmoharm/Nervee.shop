/**
 * Monitoring and alerting utilities for Edge Functions
 *
 * - Always logs structured events to console (Supabase Edge Function logs).
 * - When a Sentry DSN is configured (SENTRY_DSN function secret, falling back
 *   to VITE_SENTRY_DSN), error/warning events are additionally forwarded to
 *   Sentry's envelope endpoint so order/email/webhook failures raise real
 *   alerts instead of dying in logs (audit OPS-02).
 * - Forwarding is fire-and-forget and can never fail the request.
 */

export interface MonitoringEvent {
  type: 'error' | 'warning' | 'info' | 'metric';
  category: string;
  message: string;
  data?: Record<string, any>;
  timestamp?: string;
  correlationId?: string;
}

// Correlation ID header name (can be customized)
export const CORRELATION_ID_HEADER = 'x-correlation-id';

const SENTRY_MAX_MESSAGE = 4096;
const SENTRY_MAX_EXTRA_JSON = 64 * 1024;
const SENTRY_CLIENT = 'nerve-edge-functions/1.0.0';

function env(name: string): string | null {
  try {
    return Deno.env.get(name) || null;
  } catch {
    return null;
  }
}

interface ParsedDsn {
  publicKey: string;
  origin: string;
  projectId: string;
}

/** Parse https://<key>@<host>/<project_id> — never logs or returns the key. */
export function parseSentryDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    if (!url.username || !projectId) return null;
    const port = url.port ? `:${url.port}` : '';
    return {
      publicKey: decodeURIComponent(url.username),
      origin: `${url.protocol}//${url.hostname}${port}`,
      projectId,
    };
  } catch {
    return null;
  }
}

function safeExtra(data: unknown): Record<string, unknown> | undefined {
  if (data === undefined) return undefined;
  try {
    const json = JSON.stringify(data);
    if (json.length > SENTRY_MAX_EXTRA_JSON) {
      return { truncated: true, originalBytes: json.length };
    }
    return { data };
  } catch {
    return undefined;
  }
}

/** Best-effort forward to Sentry. Never throws, never blocks the caller. */
export async function sendToSentry(event: MonitoringEvent): Promise<void> {
  const dsn = env('SENTRY_DSN') || env('VITE_SENTRY_DSN');
  if (!dsn) return;
  const parsed = parseSentryDsn(dsn);
  if (!parsed) {
    console.warn('[MONITORING] SENTRY_DSN is set but unparseable; event not forwarded');
    return;
  }

  const eventId = crypto.randomUUID().replace(/-/g, '');
  const envelopeHeader = { event_id: eventId, sent_at: new Date().toISOString() };
  const itemHeader = { type: 'event' };
  const extra = safeExtra(event.data);
  const payload = {
    event_id: eventId,
    level: event.type === 'error' ? 'error' : 'warning',
    message: event.message.slice(0, SENTRY_MAX_MESSAGE),
    logger: 'nerve-edge-functions',
    platform: 'other',
    environment: env('SENTRY_ENVIRONMENT') || env('VITE_ENV') || 'production',
    release: env('SENTRY_RELEASE') || undefined,
    timestamp: Date.now() / 1000,
    tags: {
      category: event.category,
      source: 'supabase-edge-function',
      ...(event.correlationId ? { correlation_id: event.correlationId } : {}),
    },
    ...(extra ? { extra } : {}),
  };

  const envelope = [
    JSON.stringify(envelopeHeader),
    JSON.stringify(itemHeader),
    JSON.stringify(payload),
  ].join('\n');

  try {
    const res = await fetch(`${parsed.origin}/api/${parsed.projectId}/envelope/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=${SENTRY_CLIENT}`,
      },
      body: envelope,
    });
    if (!res.ok) {
      console.warn(`[MONITORING] Sentry forward rejected: HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(
      '[MONITORING] Sentry forward failed:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Extract correlation ID from request headers or generate new one
 */
export function getCorrelationId(req: Request): string {
  const existing = req.headers.get(CORRELATION_ID_HEADER);
  if (existing && existing.length > 0) {
    return existing;
  }
  return generateCorrelationId();
}

/**
 * Log a structured event with context.
 * Error/warning events are additionally forwarded to Sentry when configured.
 */
export function logEvent(event: MonitoringEvent) {
  const prefix = `[${event.type.toUpperCase()}] [${event.category}]`;
  if (event.correlationId) {
    console.log(prefix, `[${event.correlationId}]`, event.message, event.data || '');
  } else {
    console.log(prefix, event.message, event.data || '');
  }

  if (event.type === 'error' || event.type === 'warning') {
    // Fire-and-forget: alerting must never slow down or fail the request.
    void sendToSentry(event);
  }
}

/**
 * Log payment webhook failure (critical)
 */
export function logWebhookFailure(reason: string, payload?: any) {
  logEvent({
    type: 'error',
    category: 'PAYMENT_WEBHOOK',
    message: `Webhook failed: ${reason}`,
    data: { payload },
  });
}

/**
 * Log order placement failure
 */
export function logOrderFailure(reason: string, customerId?: string, cart?: any) {
  logEvent({
    type: 'error',
    category: 'ORDER_PLACEMENT',
    message: `Order failed: ${reason}`,
    data: { customerId, cartItemCount: cart?.length },
  });
}

/**
 * Log successful order
 */
export function logOrderSuccess(
  orderId: string,
  orderNumber: string,
  total: number,
  paymentMethod: string,
) {
  logEvent({
    type: 'info',
    category: 'ORDER_SUCCESS',
    message: `Order placed: ${orderNumber}`,
    data: { orderId, total, paymentMethod },
  });
}

/**
 * Log payment reconciliation
 */
export function logPaymentVerification(
  orderId: string,
  status: 'success' | 'failed',
  source: 'webhook' | 'manual',
) {
  logEvent({
    type: 'info',
    category: 'PAYMENT_VERIFICATION',
    message: `Payment ${status} via ${source}`,
    data: { orderId },
  });
}

/**
 * Log inventory issue
 */
export function logInventoryIssue(productId: string, size: string, reason: string) {
  logEvent({
    type: 'warning',
    category: 'INVENTORY',
    message: `Inventory issue: ${reason}`,
    data: { productId, size },
  });
}

/**
 * Log email failure
 */
export function logEmailFailure(recipient: string, subject: string, error: string) {
  logEvent({
    type: 'error',
    category: 'EMAIL',
    message: `Email failed to ${recipient}: ${error}`,
    data: { subject },
  });
}

/**
 * Log email success
 */
export function logEmailSuccess(recipient: string, subject: string) {
  logEvent({
    type: 'info',
    category: 'EMAIL',
    message: `Email sent to ${recipient}`,
    data: { subject },
  });
}

/**
 * Log HMAC validation failure (security concern)
 */
export function logHMACFailure(ip: string, payload?: any) {
  logEvent({
    type: 'error',
    category: 'SECURITY',
    message: `HMAC validation failed from ${ip}`,
    data: { payload },
  });
}

/**
 * Log rate limit hit
 */
export function logRateLimitHit(identifier: string, endpoint: string) {
  logEvent({
    type: 'warning',
    category: 'RATE_LIMIT',
    message: `Rate limit exceeded for ${identifier}`,
    data: { endpoint },
  });
}

/**
 * Track metric (for performance monitoring)
 */
export function trackMetric(name: string, value: number, unit: string = 'ms') {
  logEvent({
    type: 'metric',
    category: 'PERFORMANCE',
    message: `${name}: ${value}${unit}`,
    data: { name, value, unit },
  });
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;

  constructor(private label: string) {
    this.startTime = performance.now();
  }

  end() {
    const duration = performance.now() - this.startTime;
    trackMetric(this.label, Math.round(duration));
    return duration;
  }
}

/**
 * Wrap async function with monitoring
 */
export async function monitored<T>(
  label: string,
  fn: () => Promise<T>,
  onError?: (error: Error) => void,
): Promise<T> {
  const timer = new PerformanceTimer(label);
  try {
    const result = await fn();
    timer.end();
    return result;
  } catch (error) {
    timer.end();
    const err = error instanceof Error ? error : new Error(String(error));
    logEvent({
      type: 'error',
      category: 'FUNCTION_ERROR',
      message: `${label} failed: ${err.message}`,
      data: { error: err.toString() },
    });
    if (onError) onError(err);
    throw err;
  }
}
