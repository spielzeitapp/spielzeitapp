import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppBackground } from './AppBackground';

/**
 * Reduziertes Auth-Layout: kein Header, keine Bottom-/Top-Navigation.
 * Für Passwort setzen / ähnliche Auth-Flows auf kleinen Viewports (iPhone, Gmail-WebView).
 */
export function AuthMinimalLayout({ children }: { children?: React.ReactNode }): React.ReactElement {
  return (
    <AppBackground>
      <div
        className="flex min-h-[100dvh] min-h-screen flex-col bg-black text-white"
        style={{ minHeight: '100dvh' }}
      >
        <main
          className="flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[max(2rem,env(safe-area-inset-bottom,0px))] pt-[max(1.25rem,env(safe-area-inset-top,0px))]"
        >
          <div className="mx-auto w-full max-w-[480px]">{children ?? <Outlet />}</div>
        </main>
      </div>
    </AppBackground>
  );
}
