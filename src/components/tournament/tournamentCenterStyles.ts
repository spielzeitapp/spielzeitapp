/** @deprecated Use eventCenterStyles — kept for tournament imports. */
export {
  EC_CARD as TC_CARD,
  EC_CARD_INNER as TC_CARD_INNER,
  EC_STACK_GAP as TC_STACK_GAP,
  EC_SECTION_LABEL as TC_SECTION_LABEL,
  EC_META_ICON as TC_META_ICON,
} from '../center/eventCenterStyles';

export type TournamentCenterTabId = 'overview' | 'games' | 'table' | 'teams';

export const TOURNAMENT_CENTER_TABS: { id: TournamentCenterTabId; label: string }[] = [
  { id: 'overview', label: 'Überblick' },
  { id: 'games', label: 'Spiele' },
  { id: 'table', label: 'Tabelle' },
  { id: 'teams', label: 'Teams' },
];
