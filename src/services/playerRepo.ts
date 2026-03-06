import type { Player } from '../types/player';

const STORAGE_PREFIX = 'sz_players_v1_';

const U11_PLAYERS: Player[] = [
  { id: 'p1', firstName: 'Tobias', lastName: 'Antensteiner', number: 4 },
  { id: 'p2', firstName: 'Daniel', lastName: 'Baumann', number: 19 },
  { id: 'p3', firstName: 'Luka', lastName: 'Bradaric', number: 18 },
  { id: 'p4', firstName: 'Mohamed', lastName: 'Elkabbani', number: 12 },
  { id: 'p5', firstName: 'Matthias', lastName: 'Fasching', number: 10 },
  { id: 'p6', firstName: 'Timo', lastName: 'Freilinger', number: 1 },
  { id: 'p7', firstName: 'Jonas', lastName: 'Gamböck', number: 6 },
  { id: 'p8', firstName: 'Paul', lastName: 'Gasteiner', number: 9 },
  { id: 'p9', firstName: 'Jacob', lastName: 'Hasler', number: 11 },
  { id: 'p10', firstName: 'Florian', lastName: 'Hinterwallner', number: 2 },
  { id: 'p11', firstName: 'Matteo', lastName: 'Pracher', number: 8 },
  { id: 'p12', firstName: 'Matthias', lastName: 'Pundy', number: 7 },
  { id: 'p13', firstName: 'Theo', lastName: 'Putz', number: 2 },
  { id: 'p14', firstName: 'Nino', lastName: 'Semellechner', number: 9 },
  { id: 'p15', firstName: 'Niklas', lastName: 'Vogel', number: 5 },
];

function storageKey(teamId: string): string {
  return `${STORAGE_PREFIX}${teamId}`;
}

function readPlayers(teamId: string): Player[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(teamId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as Player[];
    }
  } catch {
    // ignore
  }
  return [];
}

function writePlayers(teamId: string, players: Player[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(teamId), JSON.stringify(players));
  } catch {
    // ignore
  }
}

export function seedPlayersIfEmpty(teamId: string): void {
  if (typeof window === 'undefined') return;
  const existing = readPlayers(teamId);
  if (existing.length > 0) return;

  if (teamId === 'u11a') {
    writePlayers(teamId, U11_PLAYERS);
  } else {
    writePlayers(teamId, []);
  }
}

export function getPlayers(teamId: string): Player[] {
  seedPlayersIfEmpty(teamId);
  return readPlayers(teamId);
}

