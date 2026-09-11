/**
 * Type definitions for 3rd-party integrations
 * Replaces 'any' types with proper event/parameter interfaces
 */

/**
 * Google Analytics 4 / gtag event arguments
 * Flexible signature to support various gtag call patterns
 */
export type GtagArgs = unknown[];

/**
 * Facebook Pixel / fbq event arguments
 * Flexible signature to support various fbq call patterns
 */
export type FbqArgs = unknown[];

/**
 * Analytics event parameters interface
 * Flexible structure for 3rd party integrations
 */
export interface AnalyticsEventParameters {
  [key: string]: unknown;
}

/**
 * Performance metric entry types for browser PerformanceObserver
 */
export interface PerformanceMetricEntry {
  name: string;
  duration?: number;
  startTime?: number;
  entryType: string;
  processingStart?: number;
  processingDuration?: number;
  presentationTime?: number;
  value?: number;
  delta?: number;
  attribution?: Record<string, unknown>;
}

/**
 * Sentry event context (replaces Record<string, any>)
 */
export interface SentryEventContext {
  [key: string]: string | number | boolean | Record<string, unknown> | null | undefined;
}

/**
 * Email automation event payload
 */
export interface EmailAutomationPayload {
  event: string;
  userId?: string;
  email?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * GA4 configuration object
 */
export interface GA4Config {
  measurementId: string;
  apiSecret?: string;
  clientId?: string;
  sessionId?: string;
}

/**
 * Cart/Order event parameters
 */
export interface EcommerceEventParams extends AnalyticsEventParameters {}
