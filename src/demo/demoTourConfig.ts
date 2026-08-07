/**
 * DEMO.2J — Geführter Spieltag-Rundgang (10 Stationen).
 * Nur echte produktive Demo-Routen, keine Fake-Seiten.
 */

import { DEMO_MATCH_ID_LIVE } from './demoDataSource';

export type DemoTourStationId =
  | 'training'
  | 'attendance'
  | 'fixture'
  | 'directions'
  | 'match_prep'
  | 'lineup'
  | 'live'
  | 'match_end'
  | 'playtime'
  | 'winner_post';

/** Spezialaktionen der Tour-Haupt-CTA (sonst nur Weiter zur nächsten Station). */
export type DemoTourPrimaryAction =
  | 'advance'
  | 'show_directions'
  | 'end_match'
  | 'show_winner_preview'
  | 'finish';

export type DemoTourStation = {
  id: DemoTourStationId;
  title: string;
  body: string;
  /** Relativ zu /demo … oder absoluter Demo-Pfad */
  path: string;
  primaryActionLabel: string;
  primaryAction: DemoTourPrimaryAction;
};

export const DEMO_TRAINING_EVENT_ID = 'ev-train-next';
export const DEMO_LOOSDORF_EVENT_ID = 'ev-game-next';

const LIVE_PATH = `/demo/live?matchId=${encodeURIComponent(DEMO_MATCH_ID_LIVE)}`;
const LIVE_PLAYTIME_PATH = `${LIVE_PATH}&tab=time`;
const PREP_PATH = `/demo/match-preparation?matchId=${encodeURIComponent(DEMO_MATCH_ID_LIVE)}`;
const LINEUP_PATH = `/demo/match-lineup?matchId=${encodeURIComponent(DEMO_MATCH_ID_LIVE)}`;

export const DEMO_TOUR_STATIONS: readonly DemoTourStation[] = [
  {
    id: 'training',
    title: 'Training',
    body: 'Plane dein Training und behalte Zusagen und Beteiligung im Blick. Öffne das nächste Training und probiere eine lokale Rückmeldung aus.',
    path: `/demo/events/${DEMO_TRAINING_EVENT_ID}`,
    primaryActionLabel: 'Beteiligung ansehen',
    primaryAction: 'advance',
  },
  {
    id: 'attendance',
    title: 'Beteiligung',
    body: 'Trainingsbeteiligung hilft dir bei Kaderplanung und fairer Spielzeit. Noah liegt bei 93 % – die Teamkennzahl zeigt die Session-Beteiligung.',
    path: '/demo/team?tab=training',
    primaryActionLabel: 'Zum Spieltermin',
    primaryAction: 'advance',
  },
  {
    id: 'fixture',
    title: 'Spieltermin',
    body: 'Alle wichtigen Informationen und Rückmeldungen an einem Ort – Gegner Loosdorf, Treffpunkt und Spielort.',
    path: `/demo/events/${DEMO_LOOSDORF_EVENT_ID}`,
    primaryActionLabel: 'Anfahrt ansehen',
    primaryAction: 'show_directions',
  },
  {
    id: 'directions',
    title: 'Anfahrt',
    body: 'Treffpunkt, Spielort und Beginn sind für das ganze Team eindeutig sichtbar.',
    path: `/demo/events/${DEMO_LOOSDORF_EVENT_ID}`,
    primaryActionLabel: 'Match vorbereiten',
    primaryAction: 'advance',
  },
  {
    id: 'match_prep',
    title: 'Matchvorbereitung',
    body: 'Stelle deinen Kader zusammen und prüfe alle Informationen vor dem Spiel. 12 Spieler sind ausgewählt, Formation vorbereitet.',
    path: PREP_PATH,
    primaryActionLabel: 'Aufstellung öffnen',
    primaryAction: 'advance',
  },
  {
    id: 'lineup',
    title: 'Aufstellung',
    body: 'Plane deine Startformation und Bank direkt am Spielfeld – Formation 1-3-3-1 mit 8 Feldspielern und 4 auf der Bank.',
    path: LINEUP_PATH,
    primaryActionLabel: 'LIVE starten',
    primaryAction: 'advance',
  },
  {
    id: 'live',
    title: 'LIVE',
    body: 'Erfasse Tore, Wechsel und Spielzeiten direkt während des Spiels. Probiere Pause, Tor oder Wechsel – alles bleibt lokal.',
    path: LIVE_PATH,
    primaryActionLabel: 'Demo-Spiel beenden',
    primaryAction: 'end_match',
  },
  {
    id: 'match_end',
    title: 'Spielende',
    body: 'Nach dem Abpfiff werden Ergebnis, Ereignisse und Spielzeiten zusammengeführt – ohne echte Ergebnismeldung.',
    path: LIVE_PATH,
    primaryActionLabel: 'Spielzeiten auswerten',
    primaryAction: 'advance',
  },
  {
    id: 'playtime',
    title: 'Spielzeiten',
    body: 'Du erkennst sofort, wie lange jeder Spieler eingesetzt wurde – Startelf, Bank und Wechsel inklusive.',
    path: LIVE_PLAYTIME_PATH,
    primaryActionLabel: 'Siegerpost ansehen',
    primaryAction: 'show_winner_preview',
  },
  {
    id: 'winner_post',
    title: 'Siegerpost',
    body: 'Lokale Vorschau aus den Demo-Daten. Wird nicht veröffentlicht und nicht geteilt.',
    path: LIVE_PLAYTIME_PATH,
    primaryActionLabel: 'Rundgang abschließen',
    primaryAction: 'finish',
  },
] as const;

export const DEMO_TOUR_FINISH = {
  title: 'Geschafft! Du hast einen kompletten Spieltag mit SpielzeitApp begleitet.',
  body: 'Alle Änderungen waren ausschließlich lokal in deiner Demo.',
} as const;

export const DEMO_TOUR_END_MATCH_CONFIRM =
  'Das Demo-Spiel wird lokal abgeschlossen. Es werden keine echten Daten veröffentlicht.';

export const DEMO_TOUR_WINNER_DISCLAIMER = 'Demo-Vorschau – wird nicht veröffentlicht';

export const DEMO_TOUR_STATION_COUNT = DEMO_TOUR_STATIONS.length;

export const DEMO_TOUR_WELCOME_SUB =
  'Erlebe einen kompletten Spieltag – von der Trainingsplanung bis zum Siegerpost.';

export const DEMO_TOUR_WELCOME_HINT =
  'Dauer ca. 3–5 Minuten. Alle Aktionen bleiben ausschließlich in dieser Demo.';
