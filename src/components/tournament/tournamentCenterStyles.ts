/** Turniercenter Premium — Dark Theme, rote Akzente (Match Center). */
export const TC_CARD =
  'relative overflow-hidden rounded-2xl border border-[rgba(255,71,71,0.14)] bg-[rgba(8,6,10,0.88)] shadow-[0_4px_24px_rgba(0,0,0,0.52)]';
export const TC_CARD_INNER = 'px-3 py-2 sm:px-3.5 sm:py-2.5';
export const TC_STACK_GAP = 'gap-1.5 sm:gap-2';
export const TC_SECTION_LABEL =
  'text-[9px] font-bold uppercase tracking-[0.12em] text-[rgba(255,140,140,0.78)]';
export const TC_META_ICON = 'h-3.5 w-3.5 shrink-0 text-red-400/90';

export type TournamentCenterTabId = 'overview' | 'games' | 'table' | 'teams';

export const TOURNAMENT_CENTER_TABS: { id: TournamentCenterTabId; label: string }[] = [
  { id: 'overview', label: 'Überblick' },
  { id: 'games', label: 'Spiele' },
  { id: 'table', label: 'Tabelle' },
  { id: 'teams', label: 'Teams' },
];
