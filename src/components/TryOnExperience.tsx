import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  ExternalLink,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  SwitchCamera,
  X,
} from 'lucide-react';
import type { Product } from '../types';
import {
  getSnapchatApiToken,
  getTryOnSessionConfig,
  isSecureContextForCamera,
  isWebArSupported,
} from '../lib/tryOnConfig';
import { detectDevice, lensUnlockUrl } from '../lib/snapchat';
import { useCameraKitSession } from '../hooks/useCameraKitSession';
import { trackEvent } from '../lib/analytics';
import TryOnQrPanel from './TryOnQrPanel';

export interface TryOnExperienceProps {
  product: Product;
  /** Selected color name — shown in the header so the session stays product-aware. */
  colorName?: string;
  onClose: () => void;
}

type Mode = 'unavailable' | 'qr' | 'gate' | 'live';

const INSTRUCTIONS = [
  'Allow camera access when your browser asks',
  'Stand back so your upper body is in frame',
  'See the product rendered on you in real time',
  'Move around — the AR tracks as you turn',
];

/**
 * Full Virtual Try-On experience (shared by the product-page modal and the
 * /ar/:slug page the QR code opens). Renders one of four honest states:
 *
 *   unavailable — product has no lens / config missing (dev shows exact env var)
 *   qr          — device/browser can't run web AR: real QR to this product's /ar page
 *   gate        — camera explainer + "Open AR Experience" CTA + QR fallback
 *   live        — real Snap Camera Kit session (camera + lens rendering)
 */
export default function TryOnExperience({ product, colorName, onClose }: TryOnExperienceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useBackCamera, setUseBackCamera] = useState(false);
  const [mode, setMode] = useState<Mode>('gate');

  const resolved = useMemo(() => getTryOnSessionConfig(product), [product]);
  const resolvedConfig = 'config' in resolved ? resolved.config : null;
  const resolvedError = 'error' in resolved ? resolved.error : null;
  const capabilities = useMemo(
    () => ({
      supported: isWebArSupported(),
      secure: isSecureContextForCamera(),
      device: detectDevice(),
    }),
    [],
  );

  const { status, error, stage, fps, retry } = useCameraKitSession({
    active: mode === 'live',
    config: resolvedConfig ? { ...resolvedConfig, apiToken: getSnapchatApiToken() ?? '' } : null,
    canvasRef,
    useBackCamera,
  });

  // Resolve the initial mode once config + capabilities are known.
  useEffect(() => {
    if (resolvedError) {
      setMode('unavailable');
      trackEvent('try_on_failed', {
        product_id: product.id,
        product_name: product.name,
        reason: resolvedError.code,
      });
      return;
    }
    setMode(capabilities.supported && capabilities.secure ? 'gate' : 'qr');
    trackEvent('try_on_opened', {
      product_id: product.id,
      product_name: product.name,
      lens_id: resolvedConfig?.lensId,
      device_supported: capabilities.supported,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, capabilities]);

  // Analytics for ready/failed transitions.
  useEffect(() => {
    if (status === 'ready') {
      trackEvent('try_on_started', {
        product_id: product.id,
        product_name: product.name,
        lens_id: resolvedConfig?.lensId,
      });
    } else if (status === 'error' && error) {
      trackEvent('try_on_failed', {
        product_id: product.id,
        product_name: product.name,
        reason: error.code,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const close = () => {
    trackEvent('try_on_closed', { product_id: product.id, product_name: product.name });
    onClose();
  };

  const startCamera = () => setMode('live');

  // Absolute URL of this product's dedicated AR page — the QR destination.
  const arPageUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/ar/${product.slug}` : '';

  const lensId = resolvedConfig?.lensId;
  const hasLens = Boolean(lensId);

  const openSnapLens = () => {
    if (!lensId) return;
    trackEvent('try_on_snapchat_open', {
      product_id: product.id,
      product_name: product.name,
      lens_id: lensId,
    });
    window.open(lensUnlockUrl(lensId), '_blank', 'noopener,noreferrer');
  };

  /* ---------------------------------- state: unavailable ---------------------------------- */
  if (mode === 'unavailable') {
    const isConfigIssue = resolvedError?.code === 'CONFIG_MISSING';
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 px-6">
        <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mb-5">
          <AlertTriangle size={24} className="text-error" />
        </div>
        <h3 className="nv-heading text-xl mb-2">{resolvedError?.message}</h3>
        <p className="nv-edit text-sm text-navy/60 max-w-sm mb-6">{resolvedError?.hint}</p>

        {/* Developer diagnostics — never shown to customers in production. */}
        {import.meta.env.DEV && isConfigIssue && resolvedError?.raw && (
          <pre className="text-left text-[11px] leading-relaxed bg-mist/70 border border-navy/10 rounded-md p-4 max-w-md overflow-x-auto whitespace-pre-wrap mb-6">
            {resolvedError.raw}
          </pre>
        )}

        <button
          type="button"
          onClick={close}
          className="bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors"
        >
          Back to Product
        </button>
      </div>
    );
  }

  /* ---------------------------------- state: live AR ---------------------------------- */
  if (mode === 'live') {
    return (
      <div className="flex flex-col">
        <div
          className="relative bg-navy rounded-md overflow-hidden"
          style={{ aspectRatio: '3 / 4' }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

          {/* Loading overlay */}
          {status === 'loading' && (
            <div className="absolute inset-0 bg-navy/95 flex flex-col items-center justify-center text-white gap-4 px-6 text-center">
              <Loader2 size={28} className="animate-spin text-yellow-400" />
              <p className="nv-eyebrow text-xs tracking-widest">{stage || 'Initializing AR…'}</p>
              <p className="nv-edit text-xs text-white/60">{product.name} — live Snap AR</p>
            </div>
          )}

          {/* Error / permission overlay */}
          {(status === 'error' || status === 'denied') && error && (
            <div className="absolute inset-0 bg-navy/95 flex flex-col items-center justify-center text-white gap-3 px-6 text-center">
              <ShieldAlert size={28} className="text-yellow-400" />
              <p className="nv-eyebrow text-xs tracking-widest">{error.message}</p>
              {error.hint && <p className="nv-edit text-xs text-white/70 max-w-xs">{error.hint}</p>}
              {import.meta.env.DEV && error.raw && (
                <p className="text-[10px] text-white/40 max-w-xs break-words">{error.raw}</p>
              )}
              <div className="flex gap-3 mt-3">
                <button
                  type="button"
                  onClick={retry}
                  className="nv-eyebrow text-[10px] bg-yellow-400 text-navy px-5 py-2.5 hover:bg-yellow-300 transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw size={12} /> Try Again
                </button>
                <button
                  type="button"
                  onClick={() => setMode('gate')}
                  className="nv-eyebrow text-[10px] border border-white/30 text-white px-5 py-2.5 hover:bg-white/10 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Ready controls */}
          {status === 'ready' && (
            <>
              <div className="absolute top-3 left-3 bg-white/90 rounded-full px-3 py-1.5 flex items-center gap-2">
                <Sparkles size={12} className="text-navy" />
                <span className="nv-edit text-[11px] font-semibold text-navy uppercase truncate max-w-[180px]">
                  {product.name}
                  {colorName ? ` — ${colorName}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUseBackCamera(v => !v)}
                aria-label={useBackCamera ? 'Switch to front camera' : 'Switch to back camera'}
                className="absolute top-3 right-14 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
              >
                <SwitchCamera size={16} className="text-navy" />
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Close Virtual Try-On"
                className="absolute top-3 right-3 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
              >
                <X size={16} className="text-navy" />
              </button>
              {useBackCamera && (
                <p className="absolute bottom-3 left-1/2 -translate-x-1/2 nv-eyebrow text-[9px] bg-navy/70 text-white px-3 py-1.5 rounded-full">
                  Rear camera — garment lenses are built for selfies
                </p>
              )}
            </>
          )}
        </div>

        <p className="nv-edit text-[11px] text-navy/50 mt-3 text-center">
          Powered by Snap Camera Kit — the lens renders this product on you in real time.
        </p>

        {/* Dev diagnostics panel — hidden from customers in production. */}
        {import.meta.env.DEV && (
          <div className="mt-4 bg-mist/60 border border-navy/10 rounded-md p-4 text-[11px] leading-relaxed text-navy/70">
            <p className="nv-eyebrow text-[9px] text-navy/50 mb-2">AR Diagnostics (dev only)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Product</span>
              <span className="text-right font-medium">
                {product.name} ({product.id})
              </span>
              <span>Lens ID</span>
              <span className="text-right font-mono text-[10px] truncate">{lensId ?? '—'}</span>
              <span>Lens Group</span>
              <span className="text-right font-mono text-[10px] truncate">
                {resolvedConfig?.lensGroupId ?? '—'}
              </span>
              <span>Snap API token</span>
              <span className="text-right">{getSnapchatApiToken() ? 'present' : 'MISSING'}</span>
              <span>SDK</span>
              <span className="text-right">@snap/camera-kit (web)</span>
              <span>Session</span>
              <span className="text-right uppercase">
                {status}
                {stage ? ` — ${stage}` : ''}
              </span>
              <span>FPS</span>
              <span className="text-right">{fps ?? '—'}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* --------------------------- states: gate (start) + QR fallback --------------------------- */
  const showCameraFirst = capabilities.supported && capabilities.secure;
  const qrOnly = mode === 'qr';

  return (
    <div>
      {/* Intro */}
      <div className="text-center mb-6">
        <p className="nv-eyebrow text-[10px] text-navy/50 mb-2">Virtual Try-On</p>
        <h3 className="nv-heading text-2xl mb-2">See {product.name} in AR</h3>
        <p className="nv-edit text-sm text-navy/60">
          {qrOnly
            ? capabilities.supported
              ? 'Camera access needs HTTPS. Scan with your phone to try this product on in real time.'
              : 'This device or browser can’t run in-page AR. Scan with your phone to try it on.'
            : `Use your camera to see ${product.name} on you, live.`}
        </p>
      </div>

      {/* Primary flow */}
      {showCameraFirst ? (
        <>
          <button
            type="button"
            onClick={startCamera}
            className="w-full bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors flex items-center justify-center gap-2"
          >
            <Camera size={16} /> Open AR Experience
          </button>

          {/* Instructions */}
          <div className="bg-mist/50 border border-navy/10 rounded-md p-5 mt-4 text-left">
            <p className="nv-edit font-semibold text-sm text-navy mb-3">How it works</p>
            <ol className="space-y-2">
              {INSTRUCTIONS.map((step, i) => (
                <li key={step} className="flex gap-3 text-xs text-navy/70">
                  <span className="font-bold text-navy">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : (
        !capabilities.secure &&
        capabilities.supported && (
          <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-md p-4 mb-4">
            <ShieldAlert size={16} className="text-warning flex-shrink-0 mt-0.5" />
            <p className="nv-edit text-xs text-navy/70">
              Camera access requires a secure (HTTPS) connection.
            </p>
          </div>
        )
      )}

      {/* Real QR code for the current product — only when a valid destination exists. */}
      {qrOnly ? (
        <div className="mt-6">
          <TryOnQrPanel
            targetUrl={arPageUrl}
            productName={product.name}
            onOpenHere={capabilities.supported ? startCamera : undefined}
          />
        </div>
      ) : (
        <div className="mt-6">
          <TryOnQrPanel
            targetUrl={arPageUrl}
            productName={product.name}
            onOpenHere={showCameraFirst ? undefined : startCamera}
          />
        </div>
      )}

      {/* Official Snapchat lens fallback — real action via the official unlock URL. */}
      {hasLens && (
        <button
          type="button"
          onClick={openSnapLens}
          className="w-full mt-4 border border-navy/25 nv-eyebrow py-3.5 hover:bg-mist transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink size={14} /> Open Snapchat Lens
        </button>
      )}

      <button
        type="button"
        onClick={close}
        className="w-full mt-3 nv-eyebrow py-3.5 text-navy/60 hover:text-navy transition-colors"
      >
        Close
      </button>

      {/* Dev diagnostics for the pre-camera states. */}
      {import.meta.env.DEV && resolvedConfig && (
        <div className="mt-4 bg-mist/60 border border-navy/10 rounded-md p-4 text-[11px] text-navy/70 grid grid-cols-2 gap-x-4 gap-y-1">
          <span>Product</span>
          <span className="text-right font-medium">
            {product.name} ({product.id})
          </span>
          <span>Lens ID</span>
          <span className="text-right font-mono text-[10px] truncate">{lensId}</span>
          <span>Web AR</span>
          <span className="text-right">
            {capabilities.supported ? 'supported' : 'unsupported'} /{' '}
            {capabilities.secure ? 'secure' : 'insecure'}
          </span>
          <span>Device</span>
          <span className="text-right">
            {capabilities.device.isMobile
              ? capabilities.device.isIOS
                ? 'iOS'
                : capabilities.device.isAndroid
                ? 'Android'
                : 'mobile'
              : 'desktop'}
          </span>
        </div>
      )}
    </div>
  );
}
