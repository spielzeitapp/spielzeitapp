import type { PlayerItem } from '../hooks/usePlayers';

/** Einheitliches Kader-Modell für Live / Setup / Engine (Supabase `players.id`). */
export type RosterPlayer = {
  id: string;
  name: string;
  number: number;
  displayName: string;
  jerseyNumber: number | null;
  position: string | null;
  avatarUrl: string | null;
};

export function playerItemToRoster(p: PlayerItem): RosterPlayer {
  return {
    id: p.id,
    name: p.display_name,
    number: p.jersey_number ?? 0,
    displayName: p.display_name,
    jerseyNumber: p.jersey_number ?? null,
    position: p.position ?? null,
    avatarUrl: p.avatar_url ?? null,
  };
}

function splitName(name: string): { first: string; last: string } {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

export function compareRosterPlayers(a: RosterPlayer, b: RosterPlayer): number {
  const an = a.jerseyNumber ?? Number.MAX_SAFE_INTEGER;
  const bn = b.jerseyNumber ?? Number.MAX_SAFE_INTEGER;
  if (an !== bn) return an - bn;
  const aName = splitName(a.displayName || a.name);
  const bName = splitName(b.displayName || b.name);
  const lastCmp = aName.last.localeCompare(bName.last, "de");
  if (lastCmp !== 0) return lastCmp;
  return aName.first.localeCompare(bName.first, "de");
}

export function comparePlayerItems(a: PlayerItem, b: PlayerItem): number {
  const an = a.jersey_number ?? Number.MAX_SAFE_INTEGER;
  const bn = b.jersey_number ?? Number.MAX_SAFE_INTEGER;
  if (an !== bn) return an - bn;
  const aName = splitName(a.display_name);
  const bName = splitName(b.display_name);
  const lastCmp = aName.last.localeCompare(bName.last, "de");
  if (lastCmp !== 0) return lastCmp;
  return aName.first.localeCompare(bName.first, "de");
}
