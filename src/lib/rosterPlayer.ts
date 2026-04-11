import type { PlayerItem } from '../hooks/usePlayers';

/** Einheitliches Kader-Modell für Live / Setup / Engine (Supabase `players.id`). */
export type RosterPlayer = {
  id: string;
  name: string;
  number: number;
};

export function playerItemToRoster(p: PlayerItem): RosterPlayer {
  return {
    id: p.id,
    name: p.display_name,
    number: p.jersey_number ?? 0,
  };
}
