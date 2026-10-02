export type MatchdayDesign = {
  template: 'clean' | 'player';
  playerId: string | null;
  imageUrl: string | null;
  playerName: string | null;
};

export const CLEAN_MATCHDAY_DESIGN: MatchdayDesign = {
  template: 'clean', playerId: null, imageUrl: null, playerName: null,
};

export const DEMO_MATCHDAY_DESIGNS: MatchdayDesign[] = [
  { template: 'player', playerId: 'demo-reference', imageUrl: '/feed/demo-matchday-player-reference.webp', playerName: 'Demo-Spieler 1' },
  { template: 'player', playerId: 'demo-alternative', imageUrl: '/feed/demo-matchday-player-01.webp', playerName: 'Demo-Spieler 2' },
];

export function parseMatchdayDesign(raw: unknown): MatchdayDesign {
  if (!raw || typeof raw !== 'object') return CLEAN_MATCHDAY_DESIGN;
  const p = raw as Record<string, unknown>;
  const url = typeof p.imageUrl === 'string' ? p.imageUrl.trim() : '';
  if (p.template !== 'player' || !/^(https:\/\/|\/[^/])/.test(url)) return CLEAN_MATCHDAY_DESIGN;
  return {
    template: 'player', imageUrl: url,
    playerId: typeof p.playerId === 'string' ? p.playerId : null,
    playerName: typeof p.playerName === 'string' ? p.playerName : null,
  };
}

/** Altersgruppe wird im Poster separat dargestellt; Vereinszusätze A/B bleiben. */
export function posterClubName(name: string): string {
  return name.replace(/\bU\s*\d{1,2}\b/gi, '').replace(/\s+/g, ' ').trim();
}
