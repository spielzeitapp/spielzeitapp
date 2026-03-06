import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppBackground } from './AppBackground';
import { BottomTabs } from '../components/BottomTabs';
import { TeamSwitcher } from '../components/TeamSwitcher';
import { RoleSwitcherDev } from '../components/RoleSwitcherDev';

const logo = import.meta.env.BASE_URL + "logos/nsg-goelsental.png";

export const RootLayout: React.FC = () => {
  return (
    <AppBackground>
      <div className="app">
        <header className="topbar app__topbar">
          <img src={logo} alt="NSG Gölsental" className="topbar__logo" width={32} height={32} />
          <div className="flex flex-col min-w-0">
            <span className="text-[0.7rem] uppercase tracking-wide text-[var(--text-sub)]">SpielzeitApp</span>
            <span className="text-lg font-semibold text-[var(--text-main)] leading-tight truncate">NSG Gölsental</span>
          </div>
          <div className="flex-1 flex justify-center min-w-0">
            <TeamSwitcher />
          </div>
          <div className="flex items-center justify-end flex-shrink-0">
            <RoleSwitcherDev />
          </div>
        </header>

        <main className="app__content">
          <Outlet />
        </main>

        <BottomTabs />
      </div>
    </AppBackground>
  );
};
