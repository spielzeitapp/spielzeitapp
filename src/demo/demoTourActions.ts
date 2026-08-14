/**
 * DEMO.2J — Tour-seitige Live-Aktionen (nur lokal, keine produktiven Writes).
 */

import { DEMO_MATCH_ID_LIVE } from './demoDataSource';
import {
  appendDemoLiveEvent,
  getDemoLiveMatchRow,
  getDemoLiveRuntimeScore,
  patchDemoLiveMatchRow,
} from './demoLiveRuntime';
import { getDemoFixturePlayer } from './demoPlayers';

/** LiveMatchScreen lauscht darauf und synchronisiert lokalen UI-State. */
export const DEMO_TOUR_FINISH_MATCH_EVENT = 'spielzeit:demo-tour-finish-match';

/** LiveMatchScreen wechselt zum Spielzeiten-Tab. */
export const DEMO_TOUR_FOCUS_PLAYTIME_EVENT = 'spielzeit:demo-tour-focus-playtime';

/** Overlay-Hauptaktion → Formularseiten (Training/Spiel/RSVP). */
export const DEMO_TOUR_PRIMARY_EVENT = 'spielzeit:demo-tour-primary';

export function requestDemoTourFocusPlaytime(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DEMO_TOUR_FOCUS_PLAYTIME_EVENT));
}

export function requestDemoTourPrimaryAction(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DEMO_TOUR_PRIMARY_EVENT));
}

export type DemoWinnerPreviewData = {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  scorers: { player_name: string; minute_label: string }[];
  caption: string;
};

/** Lokales Spielende für den Rundgang (kein Feed, kein Supabase). */
export function finishDemoLiveMatchForTour(matchId: string = DEMO_MATCH_ID_LIVE): boolean {
  const mid = String(matchId ?? '').trim() || DEMO_MATCH_ID_LIVE;
  const row = getDemoLiveMatchRow(mid);
  if (!row) return false;

  const elapsed = Math.max(Number(row.live_elapsed_seconds ?? 0) || 0, 18 * 60 + 30);

  if (row.status !== 'finished') {
    appendDemoLiveEvent({
      match_id: mid,
      type: 'final_whistle',
      minute: elapsed,
    });
    patchDemoLiveMatchRow(mid, {
      status: 'finished',
      live_is_running: false,
      live_elapsed_seconds: elapsed,
    });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(DEMO_TOUR_FINISH_MATCH_EVENT, { detail: { matchId: mid } }),
    );
  }
  return true;
}

/** Vorschau-Daten aus aktueller Demo-Session (Seed-Tore + Endstand). */
export function buildDemoWinnerPreviewData(
  matchId: string = DEMO_MATCH_ID_LIVE,
): DemoWinnerPreviewData {
  const score = getDemoLiveRuntimeScore(matchId) ?? { scoreHome: 2, scoreAway: 1 };
  const homeName = 'NSG Rohrbach U12 – Demo';
  const awayName = 'SV Loosdorf U12';
  const noah = getDemoFixturePlayer('p08');
  const elias = getDemoFixturePlayer('p10');
  const scorers = [
    {
      player_name: noah ? `${noah.firstName} ${noah.lastInitial}` : 'Noah K.',
      minute_label: "4'",
    },
    {
      player_name: elias ? `${elias.firstName} ${elias.lastInitial}` : 'Elias F.',
      minute_label: "17'",
    },
  ];
  const caption = `🔥 ENDSTAND!\n${homeName} gewinnt ${score.scoreHome}:${score.scoreAway} gegen ${awayName}.\nStarker Einsatz unserer Mannschaft!`;
  return {
    homeName,
    awayName,
    homeScore: score.scoreHome,
    awayScore: score.scoreAway,
    scorers,
    caption,
  };
}
