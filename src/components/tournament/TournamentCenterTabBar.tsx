import React from 'react';
import { getTournamentCenterTabs, type TournamentCenterTabId } from './tournamentCenterStyles';

type Props = {
  activeTab: TournamentCenterTabId;
  onTabChange: (tab: TournamentCenterTabId) => void;
  canManage?: boolean;
};

export function TournamentCenterTabBar({ activeTab, onTabChange, canManage = false }: Props) {
  const tabs = getTournamentCenterTabs(canManage);
  const gridCols = tabs.length >= 5 ? 'grid-cols-5' : 'grid-cols-4';

  return (
    <nav
      className="sticky top-0 z-[5] -mx-0.5 rounded-2xl border border-[rgba(255,71,71,0.12)] bg-[rgba(6,4,8,0.94)] p-1 backdrop-blur-sm"
      aria-label="Turniercenter Bereiche"
    >
      <div className={`grid ${gridCols} gap-0.5`}>
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`min-h-[36px] rounded-xl px-0.5 py-1.5 text-[10px] font-semibold leading-tight touch-manipulation transition sm:px-1 sm:text-[11px] ${
                active
                  ? 'bg-[rgba(255,71,71,0.16)] text-white shadow-[inset_0_0_0_1px_rgba(255,71,71,0.28)]'
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
