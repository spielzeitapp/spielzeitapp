/** Tournament surfaces share the team/profile design and inherit the event club theme. */
export const TC_CARD = 'relative overflow-hidden rounded-2xl border sz-club-surface sz-club-surface--quiet';
export const TC_CARD_INNER = 'px-4 py-4 sm:px-5';
export const TC_STACK_GAP = 'gap-4';
export const TC_SECTION_LABEL = 'sz-club-accent-text text-[14px] font-bold uppercase tracking-[0.12em]';
export const TC_META_ICON = 'sz-club-accent-text h-3.5 w-3.5 shrink-0';

export type TournamentCenterTabId = 'games' | 'table' | 'teams' | 'admin';

const BASE_TABS: { id: TournamentCenterTabId; label: string }[] = [
  { id: 'games', label: 'Spielplan' },
  { id: 'table', label: 'Tabelle' },
  { id: 'teams', label: 'Teilnehmer' },
];

const ADMIN_TAB: { id: TournamentCenterTabId; label: string } = {
  id: 'admin',
  label: 'Vorbereitung',
};

export function getTournamentCenterTabs(canManage: boolean): { id: TournamentCenterTabId; label: string }[] {
  return canManage ? [ADMIN_TAB, ...BASE_TABS] : BASE_TABS;
}

/** @deprecated Use getTournamentCenterTabs */
export const TOURNAMENT_CENTER_TABS = BASE_TABS;
