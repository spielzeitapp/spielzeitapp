import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppBackground } from './AppBackground';

/**
 * Reduziertes Auth-Layout: kein Header, keine Bottom-/Top-Navigation.
 * Oben safe-area + scrollbar (kein Vertical-Centering), damit Safari-Mobile
 * Überschriften nicht unter der Adressleiste abschneidet.
 */
export function AuthMinimalLayout({ children }: { children?: React.ReactNode }): React.ReactElement {
  return (
    <AppBackground>
      <div
        className="flex min-h-[100dvh] min-h-screen flex-col bg-black text-white"
        style={{ minHeight: '100dvh' }}
      >
        <main
          className="flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1rem))] pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))]"
        >
          <div className="mx-auto w-full max-w-[480px]">{children ?? <Outlet />}</div>
        </main>
      </div>
    </AppBackground>
  );
}
