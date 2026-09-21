import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Camera, RefreshCw, Smartphone } from 'lucide-react';

interface TryOnQrPanelProps {
  /** Absolute URL of this product's /ar/:slug page — the QR destination. */
  targetUrl: string;
  productName: string;
  /** Optional: render inside a light box (used on dark AR background). */
  inverted?: boolean;
  onOpenHere?: () => void;
  onCopy?: () => void;
}

/**
 * Real, scannable QR code pointing at the current product's dedicated
 * /ar/:slug page. The destination page re-resolves the lens config itself,
 * so the QR can never mix up two products' lenses. Rendered only when a
 * valid absolute URL exists — no placeholder codes.
 */
export default function TryOnQrPanel({
  targetUrl,
  productName,
  inverted = false,
  onOpenHere,
}: TryOnQrPanelProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  // Only render a QR when we truly have an absolute http(s) URL.
  const isValidUrl = /^https?:\/\//i.test(targetUrl);

  if (!isValidUrl) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
  };

  return (
    <div
      className={`rounded-lg p-5 text-center ${
        inverted ? 'bg-white' : 'bg-mist/60 border border-navy/10'
      }`}
    >
      <p className={`nv-eyebrow text-[10px] mb-4 ${inverted ? 'text-navy' : 'text-navy/60'}`}>
        Scan to try on your phone
      </p>

      <div className="inline-block bg-white p-3 rounded-md shadow-sm">
        <QRCodeSVG value={targetUrl} size={168} level="M" marginSize={2} />
      </div>

      <p className="nv-edit text-xs text-navy/70 mt-4 leading-relaxed">
        Point your phone camera at this code to open the{' '}
        <span className="font-semibold text-navy">{productName}</span> AR experience.
      </p>

      <div className="flex items-center justify-center gap-2 mt-4">
        {onOpenHere && (
          <button
            type="button"
            onClick={onOpenHere}
            className="nv-eyebrow text-[10px] border border-navy/25 px-4 py-2.5 hover:bg-navy hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Camera size={13} /> Use camera here
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          aria-live="polite"
          className="nv-eyebrow text-[10px] border border-navy/25 px-4 py-2.5 hover:bg-navy hover:text-white transition-colors flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <RefreshCw size={13} className="animate-spin" /> Link copied
            </>
          ) : (
            <>
              <Smartphone size={13} /> Copy link
            </>
          )}
        </button>
      </div>
    </div>
  );
}
