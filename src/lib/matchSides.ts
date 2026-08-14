/**
 * Eine Quelle für Stadion-Heim / Stadion-Auswärts aus Kalender-`events.is_home`.
 * `score_home` / `goal` = Stadion-Heim; `score_away` / `goal_away` = Stadion-Auswärts.
 * Sichtbare Namen ohne Altersklassenmarkierung „U11“ (Display only).
 */

import { normalizeOefbImportedTeamName } from './oefbTeamNameNormalize';

export type MatchSides = {
  homeTeamName: string;
  awayTeamName: string;
  isOwnTeamHome: boolean;
};

export function getMatchSides(params: {
  isHome: boolean | null | undefined;
  ownTeamName: string;
  opponentName: string;
}): MatchSides {
  const own = normalizeOefbImportedTeamName(params.ownTeamName) || 'Unser Team';
  const opp = normalizeOefbImportedTeamName(params.opponentName) || 'Gegner';
  if (params.isHome === true) {
    return { homeTeamName: own, awayTeamName: opp, isOwnTeamHome: true };
  }
  if (params.isHome === false) {
    return { homeTeamName: opp, awayTeamName: own, isOwnTeamHome: false };
  }
  return { homeTeamName: own, awayTeamName: opp, isOwnTeamHome: true };
}

/** Kurzlabel für Tor-Buttons (+ Kürzel oder erster Wortteil). */
export function shortTeamGoalLabel(fullName: string): string {
  const raw = normalizeOefbImportedTeamName(fullName) || (fullName || '').trim();
  if (!raw) return '+';
  const tokens = raw.split(/\s+/).filter(Boolean);
  const first = tokens[0] ?? raw;
  if (first.length <= 12) return `+ ${first}`;
  return `+ ${first.slice(0, 10)}…`;
}
