import React from 'react';
import { getTournamentCenterTabs, type TournamentCenterTabId } from './tournamentCenterStyles';

type Props = {
  activeTab: TournamentCenterTabId;
  onTabChange: (tab: TournamentCenterTabId) => void;
  canManage?: boolean;
  actions?: React.ReactNode;
};

export function TournamentCenterTabBar({ activeTab, onTabChange, canManage = false, actions }: Props) {
  const tabs = getTournamentCenterTabs(canManage);

  return (
    <nav
      className="sticky top-[calc(var(--app-header-offset,0px)+48px)] z-[5] -mx-0.5 rounded-[18px] border sz-club-list-card bg-[#0c0c0f] p-1 backdrop-blur-sm"
      aria-label="Turniercenter — Nachsehen"
    >
      <div className={`grid gap-0.5 ${canManage ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`min-h-[48px] min-w-0 whitespace-nowrap rounded-xl border border-transparent px-0.5 py-2 text-[16px] font-semibold leading-tight touch-manipulation transition sm:text-[16px] ${
                active
                  ? 'sz-club-tab-active text-white'
                  : 'text-white/50 hover:text-white/75'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {actions ? <div className="mt-1 border-t border-white/[0.06] pt-1">{actions}</div> : null}
    </nav>
  );
}
