import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { ManifestSync } from './app/ManifestSync';
import './index.css';
import { SessionProvider } from './auth/useSession';
import { AuthProvider } from './auth/AuthProvider';

/** Wird in index.html vor dem React-Load gesetzt: app.spielzeitapp.at = true, sonst false. */
const isInternalDomain =
  typeof window !== 'undefined' &&
  (window as Window & { __HOST_IS_INTERNAL__?: boolean }).__HOST_IS_INTERNAL__ === true;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ManifestSync />
      <AuthProvider>
        <SessionProvider>
          <App isInternalDomain={isInternalDomain} />
        </SessionProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
