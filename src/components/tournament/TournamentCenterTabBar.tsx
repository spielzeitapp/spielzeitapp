import React from 'react';
import { getTournamentCenterTabs, type TournamentCenterTabId } from './tournamentCenterStyles';

type Props = {
  activeTab: TournamentCenterTabId;
  onTabChange: (tab: TournamentCenterTabId) => void;
  canManage?: boolean;
};

export function TournamentCenterTabBar({ activeTab, onTabChange, canManage = false }: Props) {
  const tabs = getTournamentCenterTabs(canManage);

  return (
    <nav
      className="sticky top-0 z-[5] -mx-0.5 rounded-2xl border sz-club-tab-track bg-[#0c0c0f] p-1 backdrop-blur-sm"
      aria-label="Turniercenter — Nachsehen"
    >
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`min-h-[40px] shrink-0 flex-1 whitespace-nowrap rounded-xl border border-transparent px-3 py-2 text-[12px] font-semibold leading-tight touch-manipulation transition sm:text-[12px] ${
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
    </nav>
  );
}
