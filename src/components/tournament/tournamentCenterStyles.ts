/** Tournament surfaces share the team/profile design and inherit the event club theme. */
export const TC_CARD = 'relative overflow-hidden rounded-2xl border sz-club-surface sz-club-surface--quiet';
export const TC_CARD_INNER = 'px-3 py-3 sm:px-3.5';
export const TC_STACK_GAP = 'gap-2 sm:gap-2.5';
export const TC_SECTION_LABEL = 'sz-club-accent-text text-[10px] font-bold uppercase tracking-[0.12em]';
export const TC_META_ICON = 'sz-club-accent-text h-3.5 w-3.5 shrink-0';

export type TournamentCenterTabId = 'overview' | 'games' | 'table' | 'teams' | 'admin';

const BASE_TABS: { id: TournamentCenterTabId; label: string }[] = [
  { id: 'overview', label: 'Status' },
  { id: 'games', label: 'Spielplan' },
  { id: 'table', label: 'Tabelle' },
  { id: 'teams', label: 'Teilnehmer' },
];

const ADMIN_TAB: { id: TournamentCenterTabId; label: string } = {
  id: 'admin',
  label: 'Verwaltung',
};

export function getTournamentCenterTabs(canManage: boolean): { id: TournamentCenterTabId; label: string }[] {
  return canManage ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;
}

/** @deprecated Use getTournamentCenterTabs */
export const TOURNAMENT_CENTER_TABS = BASE_TABS;
