/**
 * Virtual Try-On (Snap AR / Camera Kit) types
 *
 * A product is AR-enabled when it has a virtualTryOn config with enabled: true
 * and a real lensId. Lens IDs and Lens Group IDs come from the Snap Kit
 * Developer Portal + Lens Scheduler (https://kit.snapchat.com/portal).
 */

/** Product-level AR configuration (stored per product). */
export interface VirtualTryOnConfig {
  /** Master switch — AR surfaces are hidden when false/undefined. */
  enabled: boolean;
  /** Real Lens ID (UUID, no dashes) from Snap's Lens Scheduler. */
  lensId: string;
  /**
   * Lens Group ID the lens belongs to. Required by Camera Kit to load a lens.
   * May fall back to VITE_SNAPCHAT_LENS_GROUP_ID when omitted.
   */
  lensGroupId?: string;
  /** Marketing call-out shown under the TRY ON button (e.g. "Powered by Snap AR"). */
  label?: string;
}

/** Internal shape used by the try-on UI once config has been resolved. */
export interface TryOnSessionConfig extends VirtualTryOnConfig {
  lensGroupId: string;
}

/** Coarse product info the try-on experience needs alongside the lens config. */
export interface TryOnProductContext {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: 'EGP';
  /** Currently selected color name, so the AR entry point can be product-aware. */
  colorName?: string;
}

/** High-level machine states for the try-on flow. */
export type TryOnStatus =
  | 'idle' // not started
  | 'loading' // SDK bootstrapping / lens loading / camera starting
  | 'ready' // AR session live
  | 'denied' // camera permission denied
  | 'error' // any other failure (message in errorDetail)
  | 'unsupported'; // device/browser cannot run web AR

/** Specific failure classification, used for messaging + diagnostics. */
export type TryOnErrorCode =
  | 'CONFIG_MISSING' // env vars / lens config not provided
  | 'NO_LENS' // product has no AR config
  | 'UNSUPPORTED_BROWSER' // no getUserMedia / WebAssembly
  | 'PERMISSION_DENIED'
  | 'PERMISSION_UNAVAILABLE' // camera busy / hardware error
  | 'SDK_INIT_FAILED' // bootstrapCameraKit threw
  | 'LENS_LOAD_FAILED' // invalid lens id / network / lens group mismatch
  | 'SESSION_FAILED' // session/play/startup failure
  | 'LENS_RUNTIME_ERROR' // LensExecutionError while rendering
  | 'NETWORK'
  | 'UNKNOWN';

/** User-facing error payload. */
export interface TryOnErrorDetail {
  code: TryOnErrorCode;
  /** Customer-facing headline. */
  message: string;
  /** Customer-facing recovery hint. */
  hint?: string;
  /** Raw error for logs / dev diagnostics. */
  raw?: string;
}
