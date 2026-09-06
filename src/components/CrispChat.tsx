import { useEffect } from 'react';

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

export default function CrispChat() {
  useEffect(() => {
    // Initialize Crisp chat widget
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = import.meta.env.VITE_CRISP_ID || 'YOUR_CRISP_ID';

    // Only load script if CRISP_ID is set
    if (window.CRISP_WEBSITE_ID !== 'YOUR_CRISP_ID') {
      const d = document;
      const s = d.createElement('script');
      s.src = 'https://client.crisp.chat/l.js';
      s.async = true;
      d.getElementsByTagName('head')[0].appendChild(s);
    }
  }, []);

  return null; // Crisp widget loads independently
}
