/**
 * DEMO.2H — Stationen des geführten Demo-Rundgangs (max. 7).
 * Nur echte produktive Demo-Routen, keine Fake-Seiten.
 */

import { DEMO_MATCH_ID_LIVE } from './demoDataSource';
import { DEMO_TOURNAMENT_EVENT_ID } from './demoTournamentState';

export type DemoTourStationId =
  | 'home'
  | 'team'
  | 'termine'
  | 'training'
  | 'match'
  | 'live'
  | 'tournament';

export type DemoTourStation = {
  id: DemoTourStationId;
  title: string;
  body: string;
  /** Relativ zu /demo … oder absoluter Demo-Pfad */
  path: string;
};

export const DEMO_TOUR_STATIONS: readonly DemoTourStation[] = [
  {
    id: 'home',
    title: 'Alles Wichtige auf einen Blick',
    body: 'Hier siehst du aktuelle Beiträge, kommende Termine und wichtige Mannschaftsinformationen.',
    path: '/demo/home',
  },
  {
    id: 'team',
    title: 'Dein kompletter Kader',
    body: 'Öffne Spielerprofile und sieh Mannschafts-, Trainings- und Spielinformationen zentral.',
    path: '/demo/team',
  },
  {
    id: 'termine',
    title: 'Zusagen direkt in der App',
    body: 'Teste eine lokale Rückmeldung für Training, Match oder Turnier.',
    path: '/demo/termine',
  },
  {
    id: 'training',
    title: 'Training einfach organisieren',
    body: 'Sieh Anwesenheit, Trainingsquote und Teilnehmer mit denselben Ansichten wie in der echten App.',
    path: '/demo/team?tab=training',
  },
  {
    id: 'match',
    title: 'Vom Kader bis zur Aufstellung',
    body: 'Bereite das Spiel gegen SV Loosdorf vor und stelle dein Team in der Formation 1-3-3-1 auf.',
    path: `/demo/match-preparation?matchId=${encodeURIComponent(DEMO_MATCH_ID_LIVE)}`,
  },
  {
    id: 'live',
    title: 'Das Spiel live begleiten',
    body: 'Starte die lokale Match-Uhr und teste Tore, Wechsel, FairPlay und Spielzeiten. Tippe selbst auf „Spiel beginnen“.',
    path: `/demo/live?matchId=${encodeURIComponent(DEMO_MATCH_ID_LIVE)}`,
  },
  {
    id: 'tournament',
    title: 'Auch Turniere vollständig im Blick',
    body: 'Öffne Spielplan, Tabelle und Turnierkader oder teste das eigene Turnier-Finale im LIVE-Modus.',
    path: `/demo/events/${DEMO_TOURNAMENT_EVENT_ID}`,
  },
] as const;

export const DEMO_TOUR_FINISH = {
  title: 'Du hast die wichtigsten Bereiche gesehen',
  body: 'SpielzeitApp verbindet Team, Termine, Training, Spiele, LIVE und Turniere in einer gemeinsamen App.',
} as const;

export const DEMO_TOUR_STATION_COUNT = DEMO_TOUR_STATIONS.length;
