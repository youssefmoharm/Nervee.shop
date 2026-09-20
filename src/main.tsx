import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ReactQueryProvider } from './lib/queryClient';
import './index.css';

const rootEl = document.getElementById('root');

if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:2rem;color:#fff;font-family:sans-serif;background:#061735;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;"><h1>Something went wrong</h1><p>The app could not load. Please clear your browser cache and try again.</p></div>';
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <ReactQueryProvider>
            <App />
          </ReactQueryProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
