import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

const CONSENT_KEY = 'nerve.cookieConsent';

export type CookieConsentValue = 'granted' | 'denied';

export function getCookieConsent(): CookieConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(value: CookieConsentValue) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Cookie consent banner. Analytics (GA4 / Meta Pixel) only load after
 * the visitor accepts. Essential cart/auth storage is always allowed.
 */
export default function CookieConsent() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookieConsent()) {
      setVisible(true);
    }
    // The footer's "Cookie preferences" trigger reopens the banner so a
    // stored choice can be changed or withdrawn later (AUDIT LEG-03).
    const reopen = () => setVisible(true);
    window.addEventListener('nerve:open-cookie-consent', reopen);
    return () => window.removeEventListener('nerve:open-cookie-consent', reopen);
  }, []);

  if (!visible) return null;

  const accept = () => {
    setCookieConsent('granted');
    setVisible(false);
    // Let App pick up consent without full reload if possible
    window.dispatchEvent(new Event('nerve:cookie-consent'));
  };

  const decline = () => {
    setCookieConsent('denied');
    setVisible(false);
    window.dispatchEvent(new Event('nerve:cookie-consent'));
  };

  return (
    <div
      role="dialog"
      aria-label={t('Cookie consent')}
      aria-live="polite"
      data-testid="cookie-consent"
      className="fixed bottom-0 inset-x-0 z-50 bg-navy text-white border-t border-white/10 px-5 py-4 md:px-8"
    >
      <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-white/80 flex-1">
          {t(
            'We use essential cookies to keep your cart and sign-in working. With your permission we also use analytics cookies (Google Analytics / Meta) to improve the store. See our',
          )}{' '}
          <Link to="/privacy" className="underline hover:text-white">
            {t('Privacy Policy')}
          </Link>
          .
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            type="button"
            data-testid="cookie-decline"
            onClick={decline}
            className="nv-eyebrow text-xs uppercase tracking-widest px-5 py-2.5 border border-white/30 hover:bg-white/10 transition-colors"
          >
            {t('Essential only')}
          </button>
          <button
            type="button"
            data-testid="cookie-accept"
            onClick={accept}
            className="nv-eyebrow text-xs uppercase tracking-widest px-5 py-2.5 bg-white text-navy hover:bg-mist transition-colors"
          >
            {t('Accept all')}
          </button>
        </div>
      </div>
    </div>
  );
}
