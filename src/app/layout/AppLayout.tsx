import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppBackground } from './AppBackground';
import { Header } from './Header';
import { BottomTabs } from '../components/BottomTabs';
import { TopNav } from '../components/TopNav';
import { useIsTouchLayout } from '../../hooks/useMediaQuery';

export const AppLayout: React.FC = () => {
  const isTouchLayout = useIsTouchLayout();

  return (
    <AppBackground>
      {isTouchLayout ? null : <TopNav />}

      <div className="app min-h-screen bg-black text-white">
        <Header />
        <main className="app__content appMain pt-24 pb-24">
          <Outlet />
        </main>
      </div>

      {isTouchLayout ? <BottomTabs /> : null}
    </AppBackground>
  );
};

