/** Lineup-spezifische Helfer — delegieren an premiumDesignSystem. */

import {
  dsBenchTileClass,
  dsJerseyWrapClass,
  dsLineupPositionPillClass,
  dsLineupRowClass,
} from './premiumDesignSystem';

export function matchdayLineupListRowClass(opts: {
  role: 'starter' | 'bench';
  selected?: boolean;
}): string {
  return dsLineupRowClass(opts);
}

export function matchdayLineupPositionBadgeClass(role: 'starter' | 'bench'): string {
  return dsLineupPositionPillClass(role);
}

export function matchdayBenchTileClass(selected?: boolean): string {
  return dsBenchTileClass(selected);
}

export function matchdayJerseyWrapClass(): string {
  return dsJerseyWrapClass();
}
