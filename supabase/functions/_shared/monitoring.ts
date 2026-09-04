/**
 * Monitoring and alerting utilities for Edge Functions
 * 
 * In production, these would integrate with services like:
 * - Sentry for error tracking
 * - Slack/Discord for real-time alerts
 * - Datadog/New Relic for metrics
 * 
 * For now, logs to console (visible in Supabase Edge Function logs)
 */

export interface MonitoringEvent {
  type: 'error' | 'warning' | 'info' | 'metric'
  category: string
  message: string
  data?: Record<string, any>
  timestamp?: string
}

/**
 * Log a structured event with context
 */
export function logEvent(event: MonitoringEvent) {
  const fullEvent = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  }

  // Log to console (visible in Supabase logs)
  const prefix = `[${event.type.toUpperCase()}] [${event.category}]`
  console.log(prefix, event.message, event.data || '')

  // In production, send to monitoring service
  // Example: await fetch('https://your-monitoring-endpoint', { method: 'POST', body: JSON.stringify(fullEvent) })
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
  })
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
  })
}

/**
 * Log successful order
 */
export function logOrderSuccess(orderId: string, orderNumber: string, total: number, paymentMethod: string) {
  logEvent({
    type: 'info',
    category: 'ORDER_SUCCESS',
    message: `Order placed: ${orderNumber}`,
    data: { orderId, total, paymentMethod },
  })
}

/**
 * Log payment reconciliation (COD verification)
 */
export function logPaymentVerification(orderId: string, status: 'success' | 'failed', source: 'webhook' | 'manual') {
  logEvent({
    type: 'info',
    category: 'PAYMENT_VERIFICATION',
    message: `Payment ${status} via ${source}`,
    data: { orderId },
  })
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
  })
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
  })
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
  })
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
  })
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
  })
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number

  constructor(private label: string) {
    this.startTime = performance.now()
  }

  end() {
    const duration = performance.now() - this.startTime
    trackMetric(this.label, Math.round(duration))
    return duration
  }
}

/**
 * Wrap async function with monitoring
 */
export async function monitored<T>(
  label: string,
  fn: () => Promise<T>,
  onError?: (error: Error) => void
): Promise<T> {
  const timer = new PerformanceTimer(label)
  try {
    const result = await fn()
    timer.end()
    return result
  } catch (error) {
    timer.end()
    const err = error instanceof Error ? error : new Error(String(error))
    logEvent({
      type: 'error',
      category: 'FUNCTION_ERROR',
      message: `${label} failed: ${err.message}`,
      data: { error: err.toString() },
    })
    if (onError) onError(err)
    throw err
  }
}
