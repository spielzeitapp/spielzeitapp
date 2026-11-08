import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { MANAGER_COMPARISON_BASE, isManagerComparison } from './lib/managerComparison';
import { ManifestSync } from './app/ManifestSync';
import './index.css';
import { SessionProvider } from './auth/useSession';
import { AuthProvider } from './auth/AuthProvider';
import { registerServiceWorkerInboxBridge } from './lib/pushInboxBridge';
import { registerDeploymentRefresh } from './lib/deploymentRefresh';
import { ClubThemeProvider } from './theme/ClubThemeProvider';
import { DeploymentUpdatePrompt } from './components/DeploymentUpdatePrompt';

registerServiceWorkerInboxBridge();
registerDeploymentRefresh();

/** Wird in index.html vor dem React-Load gesetzt: Produktions-Domains = true, sonst false. */
const isInternalDomain =
  typeof window !== 'undefined' &&
  (window as Window & { __HOST_IS_INTERNAL__?: boolean }).__HOST_IS_INTERNAL__ === true;

const comparison = isManagerComparison();
if (comparison && /^\/vereinszentrale\/?$/.test(window.location.pathname)) {
  window.history.replaceState(window.history.state, '', `${MANAGER_COMPARISON_BASE}/manager/plattform${window.location.search}${window.location.hash}`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={comparison ? MANAGER_COMPARISON_BASE : undefined}>
      {!comparison && <ManifestSync />}
      <DeploymentUpdatePrompt />
      <AuthProvider>
        <SessionProvider>
          <ClubThemeProvider>
            <App isInternalDomain={isInternalDomain} />
          </ClubThemeProvider>
        </SessionProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
