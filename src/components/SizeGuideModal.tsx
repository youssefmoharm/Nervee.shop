import { X } from 'lucide-react';
import SizeChartTable from './SizeChartTable';

interface SizeGuideModalProps {
  onClose: () => void;
}

export default function SizeGuideModal({ onClose }: SizeGuideModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close size guide"
        className="absolute inset-0 bg-navy/60 border-0 p-0"
        onClick={onClose}
      />
      {/* White panel states its own foreground (the app body is text-paper). */}
      <div className="relative bg-white text-navy max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-5 border-b border-navy/10">
          <h2 className="nv-heading text-2xl">Size Guide</h2>
          <button aria-label="Close" onClick={onClose} className="p-1 hover:opacity-60">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-navy/60 mb-5">
            All measurements in centimeters, taken flat. NERVE runs true to size — if you&apos;re
            between sizes, size up for an oversized fit or down for something more fitted.
          </p>
          <SizeChartTable />

          <div className="mt-6 space-y-3 text-sm text-navy/70">
            <p>
              <strong className="text-navy">How to measure:</strong>
            </p>
            <p>
              <strong className="text-navy">Chest</strong> — measure around the fullest part of your
              chest, keeping the tape level.
            </p>
            <p>
              <strong className="text-navy">Waist</strong> — measure around your natural waistline.
            </p>
            <p>
              <strong className="text-navy">Length</strong> — measure from the highest point of the
              shoulder to the hem.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
