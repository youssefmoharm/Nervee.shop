import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ReactQueryProvider } from './lib/queryClient';
import { I18nProvider } from './lib/i18n';
import { getAppLocale } from './lib/format';
import './index.css';

// Apply lang/dir before first paint (avoids RTL flash).
const initialLocale = getAppLocale();
document.documentElement.lang = initialLocale;
document.documentElement.dir = initialLocale === 'ar' ? 'rtl' : 'ltr';

const rootEl = document.getElementById('root');

if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:2rem;color:#fff;font-family:sans-serif;background:#061735;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;"><h1>Something went wrong</h1><p>The app could not load. Please clear your browser cache and try again.</p></div>';
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <I18nProvider>
        <BrowserRouter>
          <AuthProvider>
            <ReactQueryProvider>
              <App />
            </ReactQueryProvider>
          </AuthProvider>
        </BrowserRouter>
      </I18nProvider>
    </React.StrictMode>,
  );
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
