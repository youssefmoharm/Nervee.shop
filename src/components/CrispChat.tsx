import { useEffect, useState } from 'react';
import { getCookieConsent } from './CookieConsent';

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

let crispScriptInjected = false;

/**
 * Loads the Crisp chat widget only after the visitor has granted cookie consent.
 * Listens for the `nerve:cookie-consent` event so a later Accept loads it live.
 */
export default function CrispChat() {
  const [allowed, setAllowed] = useState(() => getCookieConsent() === 'granted');

  useEffect(() => {
    const sync = () => setAllowed(getCookieConsent() === 'granted');
    window.addEventListener('nerve:cookie-consent', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('nerve:cookie-consent', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;

    const websiteId = import.meta.env.VITE_CRISP_ID || 'YOUR_CRISP_ID';
    if (websiteId === 'YOUR_CRISP_ID') return;

    window.$crisp = window.$crisp || [];
    window.CRISP_WEBSITE_ID = websiteId;

    if (crispScriptInjected) return;
    crispScriptInjected = true;
    const s = document.createElement('script');
    s.src = 'https://client.crisp.chat/l.js';
    s.async = true;
    document.head.appendChild(s);
  }, [allowed]);

  return null;
}
