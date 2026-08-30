import type { PlayerItem } from '../hooks/usePlayers';
import { DEMO_TEAM_SEASON_ID } from './demoDataSource';

export const DEMO_MELK_QUERY_VALUE = 'sc-melk';
export const DEMO_MELK_TEAM_NAME = 'SC Melk Lions';
export const DEMO_MELK_AGE_GROUP = 'Frauen';
export const DEMO_MELK_SEASON = '2026/27';
export const DEMO_MELK_LOGO_URL = '/demo/sc-melk/club-logo.png';
export const DEMO_MELK_HERO_URL = '/demo/sc-melk/team-hero.jpg';

const names = [
  ['Lena', 'Krammer'],
  ['Julia', 'Aigner'],
  ['Anna', 'Schuster'],
  ['Laura', 'Huber'],
  ['Katharina', 'Leitner'],
  ['Sophie', 'Bauer'],
  ['Emilia', 'Moser'],
  ['Sarah', 'Gruber'],
  ['Nina', 'Hofer'],
  ['Marie', 'Steiner'],
  ['Lisa', 'Berger'],
  ['Johanna', 'Reiter'],
] as const;

const jerseys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18] as const;
const positions = ['TW', 'AV', 'IV', 'IV', 'AV', 'ZM', 'ZM', 'OM', 'ST', 'OM', 'ST', 'TW'] as const;

/**
 * Ausschließlich lokale, fiktive Daten für die SC-Melk-Verkaufsansicht.
 * Die ersten beiden Porträts wurden eigens für die Demo erzeugt; weitere Profile
 * nutzen bewusst den neutralen Platzhalter und keine realen Spielerinnenfotos.
 */
export const DEMO_MELK_PLAYERS: PlayerItem[] = names.map(([firstName, lastName], index) => ({
  id: `melk-p${String(index + 1).padStart(2, '0')}`,
  team_season_id: DEMO_TEAM_SEASON_ID,
  first_name: firstName,
  last_name: lastName,
  jersey_number: jerseys[index] ?? index + 1,
  position: positions[index] ?? 'ZM',
  birthdate: null,
  avatar_url:
    index === 0
      ? '/demo/sc-melk/player-a.webp'
      : index === 1
        ? '/demo/sc-melk/player-b.webp'
        : '/avatars/player-placeholder.png',
  cutout_url: null,
  is_active: true,
  status: 'active' as const,
  is_laz_player: false,
  is_injured: false,
  injured_since: null,
  injured_until: null,
  display_name: `${firstName} ${lastName}`,
}));
