/**
 * Virtual Try-On configuration resolution.
 *
 * Resolution order (first source that provides a config wins):
 *   1. Supabase-backed catalog (products.virtual_try_on jsonb column — see
 *      supabase/migrations/024_product_virtual_try_on.sql)
 *   2. Static catalog overrides (src/data/tryOnCatalog.ts)
 *   3. Single-lens fallback via VITE_SNAPCHAT_LENS_ID (+ VITE_SNAPCHAT_LENS_GROUP_ID)
 *
 * Secrets are never exposed: the Camera Kit apiToken lives in
 * VITE_SNAPCHAT_API_TOKEN, which is a public client token issued per-domain in
 * the Snap Kit Developer Portal (it is designed to ship with the web bundle —
 * it is NOT a secret like the Snap API key; access is locked to your domains).
 */

import { staticTryOnOverrides } from '../data/tryOnCatalog';
import type { Product } from '../types';
import type {
  TryOnSessionConfig,
  TryOnErrorDetail,
  VirtualTryOnConfig,
} from '../types/virtualTryOn';

/**
 * DEV-ONLY try-on sandbox, supplied as JSON in `VITE_TRYON_DEV_CONFIG`:
 *
 *   VITE_TRYON_DEV_CONFIG='{"apiToken":"<token>","lenses":{
 *      "nerve-oversized-tee":{"lensId":"<32 hex>","lensGroupId":"<32 hex>"}}}'
 *
 * Lens keys may be a product slug or id. It exists so developers, QA and E2E
 * runs can exercise the whole try-on surface (gating → gate → QR → live
 * session) for a product without waiting for Snap Camera Kit access — it is
 * equally useful for pointing a staging product at a scratch lens.
 *
 * It never weakens production: the whole branch is behind `import.meta.env.DEV`,
 * which is false in a production build, so a deploy still needs real Snap
 * credentials. And it cannot fake AR — an invalid lens here fails inside
 * Camera Kit with a real error, shown by the normal error states.
 */
interface DevTryOnSandbox {
  apiToken?: string;
  lenses: Record<string, VirtualTryOnConfig>;
}

function getDevTryOnSandbox(): DevTryOnSandbox | null {
  if (!import.meta.env.DEV) return null;
  const raw = import.meta.env.VITE_TRYON_DEV_CONFIG as string | undefined;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { apiToken?: unknown; lenses?: unknown };
    const lenses: Record<string, VirtualTryOnConfig> = {};
    if (parsed?.lenses && typeof parsed.lenses === 'object') {
      for (const [key, value] of Object.entries(parsed.lenses as Record<string, unknown>)) {
        // Listed lenses are enabled by default — `enabled: false` opts back out.
        const cfg = normalizeTryOnConfig({ enabled: true, ...(value as object) });
        if (cfg) lenses[key] = cfg;
      }
    }
    return {
      ...(typeof parsed?.apiToken === 'string' && parsed.apiToken
        ? { apiToken: parsed.apiToken }
        : {}),
      lenses,
    };
  } catch {
    if (import.meta.env.DEV) {
      console.warn('[tryOnConfig] VITE_TRYON_DEV_CONFIG is not valid JSON — ignoring it.');
    }
    return null;
  }
}

/**
 * Public client token for Camera Kit (from Snap Kit Developer Portal).
 * Read dynamically (not at module load) so builds/tests can vary the env.
 */
export function getSnapchatApiToken(): string | undefined {
  return (
    getDevTryOnSandbox()?.apiToken ||
    (import.meta.env.VITE_SNAPCHAT_API_TOKEN as string | undefined) ||
    undefined
  );
}

/** Optional default Lens Group for the single-lens fallback config. */
export const SNAPCHAT_DEFAULT_LENS_GROUP = import.meta.env.VITE_SNAPCHAT_LENS_GROUP_ID as
  | string
  | undefined;

/**
 * Camera Kit requires camera input + WebAssembly. Safe (non-crashing) check —
 * used to choose between the in-page AR experience and the QR fallback.
 */
export function isWebArSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    !!navigator.mediaDevices?.getUserMedia &&
    typeof WebAssembly === 'object' &&
    // CreateSession uses canvas rendering; WebGL2 is the practical floor.
    !!document.createElement('canvas').getContext('webgl2')
  );
}

/** Camera access requires a secure context (HTTPS or localhost). */
export function isSecureContextForCamera(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext === true;
}

/** Normalize a raw stored config; returns null for anything not usable. */
export function normalizeTryOnConfig(raw: unknown): VirtualTryOnConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const cfg = raw as Partial<VirtualTryOnConfig> & Record<string, unknown>;
  if (cfg.enabled !== true) return null;
  if (typeof cfg.lensId !== 'string' || !cfg.lensId.trim()) return null;
  // Guard against placeholder values ever reaching real UI logic.
  if (/^(YOUR_|REPLACE|PLACEHOLDER|EXAMPLE)/i.test(cfg.lensId)) return null;
  return {
    enabled: true,
    lensId: cfg.lensId.trim(),
    ...(typeof cfg.lensGroupId === 'string' && cfg.lensGroupId.trim()
      ? { lensGroupId: cfg.lensGroupId.trim() }
      : {}),
    ...(typeof cfg.label === 'string' ? { label: cfg.label } : {}),
  };
}

/** Compute the effective try-on config for a product (sync; DB layer overrides applied at load). */
export function resolveProductTryOnConfig(product: Product): VirtualTryOnConfig | null {
  // 0. DEV-only sandbox lens (VITE_TRYON_DEV_CONFIG) — highest precedence so a
  //    developer can point at a scratch lens without touching the database.
  const sandbox = getDevTryOnSandbox();
  if (sandbox) {
    const sandboxConfig =
      normalizeTryOnConfig(sandbox.lenses[product.slug]) ||
      normalizeTryOnConfig(sandbox.lenses[product.id]);
    if (sandboxConfig) return sandboxConfig;
  }

  // 1. Explicit per-product config already mapped onto the Product object
  //    (either from Supabase `virtual_try_on` jsonb or from static catalog data).
  const own = normalizeTryOnConfig((product as Product & { virtualTryOn?: unknown }).virtualTryOn);
  if (own) return own;

  // 2. Static override catalog (works for both mock + Supabase-backed products).
  const override = normalizeTryOnConfig(staticTryOnOverrides[product.id]);
  if (override) return override;

  // 3. Single-lens env fallback — applies to every product until per-product
  //    lenses are published. Explicitly documented as a stopgap.
  if (
    getSnapchatApiToken() &&
    SNAPCHAT_DEFAULT_LENS_GROUP &&
    import.meta.env.VITE_SNAPCHAT_LENS_ID
  ) {
    return normalizeTryOnConfig({
      enabled: true,
      lensId: import.meta.env.VITE_SNAPCHAT_LENS_ID,
    });
  }

  return null;
}

/** Attach the resolved config onto a product (used when hydrating from DB). */
export function withTryOnConfig(product: Product): Product {
  const config = resolveProductTryOnConfig(product);
  if (!config) return product;
  return { ...product, virtualTryOn: config } as Product & { virtualTryOn: VirtualTryOnConfig };
}

/** Full session config (lens group resolved) or a precise error. */
export function getTryOnSessionConfig(
  product: Product,
): { config: TryOnSessionConfig } | { error: TryOnErrorDetail } {
  const resolved = resolveProductTryOnConfig(product);

  if (!resolved) {
    return {
      error: {
        code: 'NO_LENS',
        message: 'Virtual Try-On is not available for this product yet.',
        hint: 'Our team is rolling AR try-on out across the collection. Check back soon.',
      },
    };
  }

  if (!getSnapchatApiToken()) {
    return {
      error: {
        code: 'CONFIG_MISSING',
        message: 'Virtual Try-On is temporarily unavailable.',
        hint: 'We are finishing AR setup on our side. Please try again later.',
        raw:
          'Missing VITE_SNAPCHAT_API_TOKEN. Create an app in the Snap Kit Developer Portal ' +
          '(https://kit.snapchat.com/portal), enable Camera Kit, and set the public API token ' +
          'as VITE_SNAPCHAT_API_TOKEN in your environment.',
      },
    };
  }

  const lensGroupId = resolved.lensGroupId || SNAPCHAT_DEFAULT_LENS_GROUP;
  if (!lensGroupId) {
    return {
      error: {
        code: 'CONFIG_MISSING',
        message: 'Virtual Try-On is temporarily unavailable.',
        hint: 'We are finishing AR setup on our side. Please try again later.',
        raw:
          'Lens Group ID missing for product ' +
          `${product.id} (lensId ${resolved.lensId}). Set VITE_SNAPCHAT_LENS_GROUP_ID or add ` +
          "lensGroupId to the product's virtual_try_on config (Lens Scheduler: " +
          'https://kit.snapchat.com/lens-scheduler).',
      },
    };
  }

  return { config: { ...resolved, lensGroupId } };
}

/** Map any thrown error during the AR pipeline to a typed, user-safe detail. */
export function classifyTryOnError(err: unknown): TryOnErrorDetail {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');

  if (/permission/i.test(raw) || (err instanceof DOMException && err.name === 'NotAllowedError')) {
    return {
      code: 'PERMISSION_DENIED',
      message: 'Camera access was blocked.',
      hint: 'Enable camera permissions in your browser settings and try again.',
      raw,
    };
  }
  if (
    (err instanceof DOMException && err.name === 'NotFoundError') ||
    /no camera|camera not/i.test(raw)
  ) {
    return {
      code: 'PERMISSION_UNAVAILABLE',
      message: 'No camera was found on this device.',
      hint: 'Try on a device with a camera to use Virtual Try-On.',
      raw,
    };
  }
  if (
    (err instanceof DOMException && err.name === 'NotReadableError') ||
    /in use|could not start|hardware/i.test(raw)
  ) {
    return {
      code: 'PERMISSION_UNAVAILABLE',
      message: 'Your camera is currently in use by another app.',
      hint: 'Close other apps or tabs using the camera, then try again.',
      raw,
    };
  }
  if (/lens/i.test(raw)) {
    return {
      code: 'LENS_LOAD_FAILED',
      message: 'The AR experience for this product failed to load.',
      hint: 'Please try again. If it keeps failing, the lens may be unpublished.',
      raw,
    };
  }
  if (/fetch|network|offline|load.*failed|abort/i.test(raw)) {
    return {
      code: 'NETWORK',
      message: 'We could not reach the AR service.',
      hint: 'Check your connection and try again.',
      raw,
    };
  }
  return {
    code: 'UNKNOWN',
    message: 'Virtual Try-On is temporarily unavailable.',
    hint: 'Please try again in a moment.',
    raw,
  };
}
