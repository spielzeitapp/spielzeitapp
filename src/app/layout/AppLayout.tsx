import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppBackground } from './AppBackground';
import { Header } from './Header';
import { BottomNav } from '../components/BottomNav';
import { TopNav } from '../components/TopNav';
import { useIsTouchLayout } from '../../hooks/useMediaQuery';

/** Öffentliche MVP-Routen: keine Header/TopNav/BottomNav. */
function isPublicMvpRoute(pathname: string): boolean {
  return pathname === '/' || pathname === '/schedule' || pathname === '/live';
}

export const AppLayout: React.FC = () => {
  const { pathname } = useLocation();
  const isTouchLayout = useIsTouchLayout();
  const publicMvp = isPublicMvpRoute(pathname);

  return (
    <AppBackground>
      {!publicMvp && (isTouchLayout ? null : <TopNav />)}

      <div className="app min-h-screen bg-black text-white">
        {!publicMvp && <Header />}
        <main
          className={`app__content appMain ${publicMvp ? 'pt-6 pb-6' : 'pt-[var(--app-header-offset)] pb-24'}`}
        >
          <Outlet />
        </main>
      </div>

      {!publicMvp && (isTouchLayout ? <BottomNav /> : null)}
    </AppBackground>
  );
};

