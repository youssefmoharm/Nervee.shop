import { useEffect } from 'react';
import { X } from 'lucide-react';
import FocusTrap from 'focus-trap-react';
import SizeChartTable from './SizeChartTable';
import { useI18n } from '../lib/i18n';

interface SizeGuideModalProps {
  onClose: () => void;
}

export default function SizeGuideModal({ onClose }: SizeGuideModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <FocusTrap active onClickOutside={onClose}>
      <div className="contents">
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label={t('Close size guide')}
            className="absolute inset-0 bg-navy/60 border-0 p-0"
            onClick={onClose}
          />
          {/* White panel states its own foreground (the app body is text-paper). */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="size-guide-title"
            className="relative bg-white text-navy max-w-lg w-full max-h-[85vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-5 border-b border-navy/10">
              <h2 id="size-guide-title" className="nv-heading text-2xl">
                {t('Size Guide')}
              </h2>
              <button aria-label={t('Close')} onClick={onClose} className="p-1 hover:opacity-60">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-navy/60 mb-5">
                {t(
                  "All measurements in centimeters, taken flat. NERVE runs true to size — if you're between sizes, size up for an oversized fit or down for something more fitted.",
                )}
              </p>
              <SizeChartTable />

              <div className="mt-6 space-y-3 text-sm text-navy/70">
                <p>
                  <strong className="text-navy">{t('How to measure:')}</strong>
                </p>
                <p>
                  <strong className="text-navy">{t('Chest')}</strong> —{' '}
                  {t('measure around the fullest part of your chest, keeping the tape level.')}
                </p>
                <p>
                  <strong className="text-navy">{t('Waist')}</strong> —{' '}
                  {t('measure around your natural waistline.')}
                </p>
                <p>
                  <strong className="text-navy">{t('Length')}</strong> —{' '}
                  {t('measure from the highest point of the shoulder to the hem.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
