/** @deprecated Use eventCenterStyles — kept for tournament imports. */
export {
  EC_CARD as TC_CARD,
  EC_CARD_INNER as TC_CARD_INNER,
  EC_STACK_GAP as TC_STACK_GAP,
  EC_SECTION_LABEL as TC_SECTION_LABEL,
  EC_META_ICON as TC_META_ICON,
} from '../center/eventCenterStyles';

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
