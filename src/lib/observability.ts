/**
 * Enhanced Observability System for NERVE
 *
 * Features:
 * - Structured logging with correlation IDs
 * - Request/response logging middleware
 * - Performance monitoring
 * - Error tracking with context
 * - Custom event tracking
 */

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'metric';

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string | null;
  context?: Record<string, unknown>;
}

// Performance metrics interface
export interface PerformanceMetrics {
  navigationStart: number;
  domInteractive: number;
  domContentLoaded: number;
  loadComplete: number;
  fcp?: number;
  lcp?: number;
}

// Custom event for analytics
export interface CustomEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: string;
}

// Global state for observability
let globalCorrelationId: string | null = null;

/**
 * Initialize observability system
 */
export function initObservability(config: { debug?: boolean; environment?: string } = {}) {
  globalCorrelationId = generateCorrelationId();
  console.log('[Observability] Initialized', { environment: config.environment });
}

/**
 * Get or create correlation ID for request tracing
 */
export function getCorrelationId(): string {
  if (!globalCorrelationId) {
    globalCorrelationId = generateCorrelationId();
  }
  return globalCorrelationId;
}

/**
 * Set correlation ID (useful for server-side or API responses)
 */
export function setCorrelationId(id: string): void {
  globalCorrelationId = id;
}

/**
 * Generate correlation ID
 */
function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Log a message with structured context
 */
export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId: globalCorrelationId,
    context,
  };

  // Log to console with level indicator
  const prefix = `[${entry.level.toUpperCase()}]`;
  if (entry.correlationId) {
    console.log(`${prefix} [${entry.correlationId}]`, message, context || '');
  } else {
    console.log(`${prefix}`, message, context || '');
  }

  // In production, send to logging service
  // Example: logToService(entry);
}

/**
 * Log debug message
 */
export function debug(message: string, context?: Record<string, unknown>): void {
  log('debug', message, context);
}

/**
 * Log info message
 */
export function info(message: string, context?: Record<string, unknown>): void {
  log('info', message, context);
}

/**
 * Log warning message
 */
export function warn(message: string, context?: Record<string, unknown>): void {
  log('warn', message, context);
}

/**
 * Log error message
 */
export function error(message: string, context?: Record<string, unknown>): void {
  log('error', message, context);
}

/**
 * Log performance metric
 */
export function metric(name: string, value: number, unit: string = 'ms'): void {
  log('metric', `${name}: ${value}${unit}`, { name, value, unit });
}

/**
 * Track page view
 */
export function trackPageView(path: string, title: string): void {
  info('Page view', { path, title });

  // Track with GA4 if available
  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
      correlation_id: globalCorrelationId,
    });
  }
}

/**
 * Track custom event
 */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  info('Custom event', { event: name, properties });

  // Track with GA4 if available
  if (window.gtag) {
    window.gtag('event', name, { ...properties, correlation_id: globalCorrelationId });
  }
}

/**
 * Track user action
 */
export function trackAction(action: string, properties?: Record<string, unknown>): void {
  trackEvent('user_action', { action, ...properties });
}

/**
 * Track error with stack trace
 */
export function trackError(err: Error | string, context?: Record<string, unknown>): void {
  const errorObj = typeof err === 'string' ? new Error(err) : err;

  log('error', 'Error occurred', {
    message: errorObj.message,
    stack: errorObj.stack,
    ...context,
  });

  // Send to Sentry if available
  if (typeof window !== 'undefined') {
    const w = window as unknown as {
      Sentry?: { captureException: (error: Error, options: unknown) => void };
    };
    if (w.Sentry) {
      w.Sentry.captureException(errorObj, { contexts: { correlation_id: globalCorrelationId } });
    }
  }
}

/**
 * Performance monitoring utilities
 */
export const PerformanceMonitor = {
  metrics: {} as PerformanceMetrics,

  /**
   * Mark a performance timestamp
   */
  mark(name: string): void {
    performance.mark(name);
  },

  /**
   * Measure between two marks
   */
  measure(name: string, startMark: string, endMark: string): number {
    const measure = performance.measure(name, startMark, endMark);
    return measure.duration;
  },

  /**
   * Get Core Web Vitals
   */
  async getCoreWebVitals(): Promise<PerformanceMetrics> {
    const metrics = {} as PerformanceMetrics;

    // Navigation timing
    const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navTiming) {
      metrics.navigationStart = navTiming.startTime;
      metrics.domInteractive = navTiming.domInteractive;
      metrics.domContentLoaded = navTiming.domContentLoadedEventEnd;
      metrics.loadComplete = navTiming.loadEventEnd;
    }

    // LCP (Largest Contentful Paint) - requires observer
    // FCP (First Contentful Paint) - from paint entries

    return metrics;
  },

  /**
   * Log performance metrics
   */
  logMetrics(): void {
    const metrics = performance.getEntriesByType('measure');

    metrics.forEach(measure => {
      metric(measure.name, measure.duration, 'ms');
    });
  },
};

/**
 * Request/Response logging helper
 */
export function createLoggingMiddleware() {
  return {
    /**
     * Log incoming request
     */
    logRequest(req: Request): string {
      const correlationId = req.headers.get('x-correlation-id') || generateCorrelationId();
      setCorrelationId(correlationId);

      debug('Incoming request', {
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries()),
      });

      return correlationId;
    },

    /**
     * Log outgoing response
     */
    logResponse(status: number, duration: number, correlationId?: string): void {
      info('Response sent', {
        status,
        duration: `${duration}ms`,
        correlationId,
      });
    },
  };
}

/**
 * Log a request with timing
 */
export async function logRequestWithTiming<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startTime = performance.now();
  const correlationId = getCorrelationId();

  try {
    debug(`Starting ${name}`, { correlationId });
    const result = await fn();
    const duration = performance.now() - startTime;

    info(`${name} completed`, {
      duration: `${duration.toFixed(2)}ms`,
      correlationId,
    });

    return result;
  } catch (err) {
    const duration = performance.now() - startTime;

    log('error', `${name} failed`, {
      duration: `${duration.toFixed(2)}ms`,
      error: err instanceof Error ? err.message : String(err),
      correlationId,
    });

    throw err;
  }
}

/**
 * Metrics aggregation helper
 */
export class MetricsAggregator {
  private metrics: Map<string, number[]> = new Map();

  record(name: string, value: number): void {
    const values = this.metrics.get(name) || [];
    values.push(value);
    this.metrics.set(name, values);
  }

  getAverage(name: string): number | undefined {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return undefined;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  getMetrics(): Record<string, { count: number; avg?: number; min?: number; max?: number }> {
    const result: Record<string, { count: number; avg?: number; min?: number; max?: number }> = {};

    this.metrics.forEach((values, name) => {
      result[name] = {
        count: values.length,
        avg: values.reduce((sum, v) => sum + v, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    });

    return result;
  }
}

/**
 * Log analytics event (GA4 compatible)
 */
export function logAnalytics(eventType: string, properties: Record<string, unknown>): void {
  info('Analytics event', { eventType, properties });

  if (window.gtag) {
    window.gtag('event', eventType, {
      ...properties,
      correlation_id: globalCorrelationId,
    });
  }
}

/**
 * Session tracking
 */
export const SessionTracker = {
  sessionId: crypto.randomUUID(),

  start(): void {
    info('Session started', { sessionId: this.sessionId });
    trackEvent('session_start', { sessionId: this.sessionId });
  },

  end(): void {
    info('Session ended', { sessionId: this.sessionId });
    trackEvent('session_end', { sessionId: this.sessionId });
  },

  trackEvent(name: string, properties?: Record<string, unknown>): void {
    trackEvent(`${name}_${this.sessionId}`, properties);
  },
};
