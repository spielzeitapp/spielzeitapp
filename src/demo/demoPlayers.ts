/**
 * Zentrale Demo-Spielerquelle (DEMO.2C+ / 2I-FIX).
 * Aktiver Kader: p01–p12. p08 = Selbstspieler. Assets p13–p15 bleiben ungenutzt liegen.
 */

import type { PlayerItem } from '../hooks/usePlayers';
import type { PlayerLastMatchRow, PlayerSeasonStats } from '../lib/stats/playerStatsService';
import { DEMO_TEAM_SEASON_ID } from './demoDataSource';
import { demoFixtures } from './demoFixtures';
import type { DemoPlayer } from './demoTypes';

/** Verknüpfter Demo-Nutzer für lokale Rückmeldungen (DEMO.2B) — nicht ändern. */
export const DEMO_SELF_PLAYER_ID = 'p08';

/** LAZ-fähig (zusätzlich zu p08). */
export const DEMO_LAZ_PLAYER_ID = 'p05';

/** Aktive Demo-Spieler-IDs (12er-Kader). */
export const DEMO_ACTIVE_PLAYER_IDS = [
  'p01',
  'p02',
  'p03',
  'p04',
  'p05',
  'p06',
  'p07',
  'p08',
  'p09',
  'p10',
  'p11',
  'p12',
] as const;

export type DemoActivePlayerId = (typeof DEMO_ACTIVE_PLAYER_IDS)[number];

/** Öffentlicher Asset-Pfad für KI-Porträts (nur Demo). */
export const DEMO_PLAYER_AVATAR_DIR = '/avatars/demo';

/**
 * Zentrale Avatar-Zuordnung über stabile Spieler-ID (aktiver Kader p01–p12).
 * Dateien: `public/avatars/demo/demo-player-pXX.webp`
 */
export function getDemoPlayerAvatarUrl(playerId: string | null | undefined): string | null {
  const id = String(playerId ?? '').trim();
  if (!/^p(0[1-9]|1[0-2])$/.test(id)) return null;
  return `${DEMO_PLAYER_AVATAR_DIR}/demo-player-${id}.webp`;
}

export function isDemoPlayerId(playerId: string | null | undefined): boolean {
  return Boolean(playerId && /^p\d{2}$/.test(playerId.trim()));
}

export function isDemoActivePlayerId(playerId: string | null | undefined): boolean {
  const id = String(playerId ?? '').trim();
  return (DEMO_ACTIVE_PLAYER_IDS as readonly string[]).includes(id);
}

export function getDemoFixturePlayer(playerId: string): DemoPlayer | undefined {
  return demoFixtures.players.find((p) => p.id === playerId);
}

/** Produktives PlayerItem-Shape für TeamPage / EventDetail / Attendance. */
export function buildDemoPlayers(): PlayerItem[] {
  return demoFixtures.players.map((p) => ({
    id: p.id,
    team_season_id: DEMO_TEAM_SEASON_ID,
    first_name: p.firstName,
    last_name: p.lastInitial,
    jersey_number: p.jersey,
    position: p.position,
    birthdate: null,
    avatar_url: getDemoPlayerAvatarUrl(p.id),
    cutout_url: null,
    is_active: true,
    status: 'active' as const,
    is_laz_player: p.id === DEMO_LAZ_PLAYER_ID || p.id === DEMO_SELF_PLAYER_ID,
    is_injured: !p.available,
    injured_since: null,
    injured_until: null,
    display_name: `${p.firstName} ${p.lastInitial}`,
  }));
}

export function getDemoPlayerSeasonStats(playerId: string): PlayerSeasonStats {
  const p = getDemoFixturePlayer(playerId);
  const games = p?.appearances ?? 0;
  const goals = p?.goals ?? 0;
  const assists = Math.max(0, Math.floor(goals * 0.4));
  const minutes = games > 0 ? games * 48 : 0;
  return {
    games,
    goals,
    assists,
    minutes,
    goalsPerGame: games > 0 ? Number((goals / games).toFixed(2)) : 0,
    averageMinutesPerGame: games > 0 ? Math.round(minutes / games) : 0,
    goalsPer90: minutes > 0 ? Number(((goals * 90) / minutes).toFixed(2)) : 0,
    yellowCards: 0,
    redCards: 0,
  };
}

/** Kurze fiktive Last-Matches für Profil-UI (keine echten Spiele). */
export function getDemoPlayerLastMatches(playerId: string): PlayerLastMatchRow[] {
  const p = getDemoFixturePlayer(playerId);
  if (!p || p.appearances <= 0) return [];
  const opponents = ['SC St. Veit U12', 'SV Loosdorf U12', 'SKN Nachwuchs U12'] as const;
  const count = Math.min(3, p.appearances);
  return Array.from({ length: count }, (_, i) => {
    const goals = i === 0 ? Math.min(p.goals, 1) : i === 1 && p.goals > 1 ? 1 : 0;
    return {
      match_id: `demo-lm-${playerId}-${i}`,
      opponent: opponents[i] ?? 'Gegner Demo',
      date: null,
      dateLabel: `Spiel ${i + 1}`,
      result: i === 0 ? '3:1' : i === 1 ? '2:1' : '1:1',
      minutes: 48,
      goals,
      wasStarter: true,
      badgeKind: 'full' as const,
      badgeLabel: 'Durchgespielt',
      subInDisplayMinute: null,
    };
  });
}

export function getDemoTrainingParticipationPct(playerId: string): number {
  return getDemoFixturePlayer(playerId)?.trainingPct ?? 0;
}

/** Sichtbarer Demo-Hinweistext (Teamseite + Hilfe). */
export const DEMO_AI_DISCLOSURE_TEXT =
  'Alle dargestellten Spieler, Trainer, Namen und Porträtfotos sind vollständig fiktive, KI-generierte Demo-Inhalte. Es werden keine realen Kinder, Trainer oder Vereinsmitglieder dargestellt.';
