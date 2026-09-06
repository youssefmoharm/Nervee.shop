import { useState } from 'react';
import { X, QrCode } from 'lucide-react';

interface ARTryOnProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
}

/**
 * AR Try-On Modal Component
 *
 * Features:
 * - QR code to scan for Snapchat Lens
 * - Direct link to open Snapchat Lens
 * - Information about trying on in AR
 *
 * Production:
 * 1. Create Snapchat Lens using Snap AR Studio
 * 2. Upload to Snapchat Lens database
 * 3. Get Lens ID and QR code
 * 4. Replace VITE_SNAPCHAT_LENS_ID with actual ID
 */

export default function ARTryOn({ isOpen, onClose, productName }: ARTryOnProps) {
  const [tried, setTried] = useState(false);
  const lensId = import.meta.env.VITE_SNAPCHAT_LENS_ID || 'YOUR_LENS_ID';
  const snapchatUrl = `snapchat://lenses/${lensId}`;

  if (!isOpen) return null;

  const handleOpenSnapchat = () => {
    setTried(true);
    // Open Snapchat Lens
    window.location.href = snapchatUrl;

    // Fallback: open web version if native app not available
    setTimeout(() => {
      if (!document.hidden) {
        window.open('https://www.snapchat.com/unlock/?type=SNAPCODE&uuid=' + lensId);
      }
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-navy/10 bg-white">
          <h2 className="text-xl font-bold text-navy">Try On {productName}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-navy/10 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={24} className="text-navy" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* AR Preview Info */}
          <div className="mb-6 text-center">
            <div className="mb-4 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg">
              <div className="text-4xl mb-2">📱</div>
              <p className="text-sm font-medium text-navy mb-1">See {productName} in AR</p>
              <p className="text-xs text-navy/60">
                Use your camera to try this product in real-time
              </p>
            </div>

            {/* QR Code Section */}
            <div className="mb-6">
              <p className="text-xs text-navy/50 mb-3 uppercase font-semibold">Scan QR Code</p>
              <div className="flex justify-center mb-4">
                <div className="w-40 h-40 bg-gray-100 rounded-lg border-2 border-navy/10 flex items-center justify-center">
                  <div className="text-center">
                    <QrCode size={64} className="mx-auto text-navy/30 mb-2" />
                    <p className="text-xs text-navy/40">QR Code</p>
                    {lensId === 'YOUR_LENS_ID' && (
                      <p className="text-xs text-red-500 mt-1">Configure SNAPCHAT_LENS_ID</p>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-navy/60 px-4">
                Point your device camera at this code, or use Snapchat camera
              </p>
            </div>

            {/* Instructions */}
            <div className="mb-6 bg-mist p-4 rounded-lg text-left">
              <p className="text-sm font-semibold text-navy mb-3">How to try on:</p>
              <ol className="text-xs text-navy/70 space-y-2">
                <li className="flex gap-2">
                  <span className="font-bold text-navy min-w-fit">1.</span>
                  <span>Open Snapchat on your phone</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy min-w-fit">2.</span>
                  <span>Point camera at QR code or scan below</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy min-w-fit">3.</span>
                  <span>See {productName} on your body in real-time</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy min-w-fit">4.</span>
                  <span>Rotate and resize to see from all angles</span>
                </li>
              </ol>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleOpenSnapchat}
              className="w-full bg-yellow-400 text-navy font-bold py-3 rounded-lg hover:bg-yellow-500 transition-colors text-sm"
            >
              🎬 Open Snapchat Lens
            </button>

            <button
              onClick={onClose}
              className="w-full text-navy border border-navy/20 py-3 rounded-lg hover:bg-mist transition-colors text-sm font-medium"
            >
              Close
            </button>

            {tried && (
              <p className="text-xs text-navy/60 text-center">
                Opening Snapchat... If it doesn&apos;t open, make sure Snapchat is installed.
              </p>
            )}
          </div>

          {/* Download Info */}
          <div className="mt-6 pt-6 border-t border-navy/10">
            <p className="text-xs text-navy/60 text-center mb-2">Don&apos;t have Snapchat?</p>
            <a
              href="https://www.snapchat.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full text-center text-xs font-medium text-yellow-600 hover:text-yellow-700 underline"
            >
              Download Snapchat →
            </a>
          </div>

          {/* Beta Notice */}
          <div className="mt-4 p-3 bg-blue-50 rounded text-center">
            <p className="text-xs text-blue-700">
              ✨ Beta Feature: AR try-on coming soon in more styles!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
