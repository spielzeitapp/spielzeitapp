/**
 * Shared detection of unresolved TURNIERlive / KO placeholders.
 * Keep adapter + plan + orchestrator in sync — no tournament-specific hardcoding.
 */

import { safeOptionalText } from './safeText';

/** Platzhalter / noch nicht aufgelöste Paarungen (vor Finalrunde). */
export function looksLikeUnresolvedTournamentTeamName(name: unknown): boolean {
  const t = safeOptionalText(name);
  if (!t) return true;
  const n = t.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(tbd|n\/?a|\?+|-+|–+|—+|null|undefined)$/i.test(n)) return true;
  if (
    /gewinner|sieger|verlierer|loser|winner|runner.?up|qualifiant|qualifier|bye\b/i.test(n)
  ) {
    return true;
  }
  // "4. Gruppe 1", "P4 Gruppe A", "Platz 4 Gruppe B"
  if (/^(1|2|3|4|5|6|7|8)\.\s*(gruppe|group|platz|place)\b/i.test(n)) return true;
  if (/^p\s*[1-8]\b/i.test(n)) return true;
  if (/^(gruppe|group)\s*[a-d0-9]+\b/i.test(n) && /platz|place|sieger|gewinner|1\.|2\.|3\.|4\./i.test(n)) {
    return true;
  }
  if (/^(hf|vf|af|sf|f)\s*\d*$/i.test(n)) return true;
  if (/^(spiel|match)\s*(um\s*)?platz\s*\d+/i.test(n)) return true;
  if (/^platz\s+\d+/i.test(n)) return true;
  return false;
}

export function slotLooksUnresolvedPairing(slot: {
  home_team?: string | null;
  away_team?: string | null;
  opponent_name?: string | null;
}): boolean {
  if (looksLikeUnresolvedTournamentTeamName(slot.home_team)) return true;
  if (looksLikeUnresolvedTournamentTeamName(slot.away_team)) return true;
  if (!safeOptionalText(slot.home_team) && !safeOptionalText(slot.away_team)) {
    if (looksLikeUnresolvedTournamentTeamName(slot.opponent_name)) return true;
  }
  return false;
}
