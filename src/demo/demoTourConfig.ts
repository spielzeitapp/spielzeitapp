/**
 * DEMO.2K — Geführter 4MAT-Rundgang durch den kompletten Traineralltag (14 HOW-Stationen).
 * WHY = Welcome, WHAT = /demo/tour/what (außerhalb der 14), HOW = Stationen, WHAT-IF = Abschluss.
 */

import { DEMO_MATCH_ID_LIVE } from './demoDataSource';

export type DemoTourChapterId = 'planen' | 'spielen' | 'begleiten' | 'auswerten';

export type DemoTourStationId =
  | 'create_training'
  | 'parent_training_rsvp'
  | 'training_attendance'
  | 'training_plan'
  | 'create_match'
  | 'parent_match_rsvp'
  | 'match_fixture'
  | 'match_prep'
  | 'lineup'
  | 'live'
  | 'playtime'
  | 'winner_post'
  | 'chronicle'
  | 'season_review';

/** Spezialaktionen der Tour-Haupt-CTA (sonst nur Weiter zur nächsten Station). */
export type DemoTourPrimaryAction =
  | 'advance'
  | 'save_training'
  | 'parent_yes_training'
  | 'save_match'
  | 'parent_yes_match'
  | 'show_directions'
  | 'end_match'
  | 'show_winner_preview'
  | 'finish';

export type DemoTourStation = {
  id: DemoTourStationId;
  chapterId: DemoTourChapterId;
  chapterLabel: string;
  title: string;
  body: string;
  benefit: string;
  /** Relativ zu /demo … oder absoluter Demo-Pfad */
  path: string;
  primaryActionLabel: string;
  primaryAction: DemoTourPrimaryAction;
};

export const DEMO_TRAINING_EVENT_ID = 'ev-train-next';
export const DEMO_LOOSDORF_EVENT_ID = 'ev-game-next';
/** Idempotente ID für lokal angelegtes Tour-Training. */
export const DEMO_TOUR_LOCAL_TRAINING_ID = 'ev-tour-training';

export const DEMO_TOUR_WHAT_PATH = '/demo/tour/what';

const LIVE_PATH = `/demo/live?matchId=${encodeURIComponent(DEMO_MATCH_ID_LIVE)}`;
const LIVE_PLAYTIME_PATH = `${LIVE_PATH}&tab=time`;
const PREP_PATH = `/demo/match-preparation?matchId=${encodeURIComponent(DEMO_MATCH_ID_LIVE)}`;
const LINEUP_PATH = `/demo/match-lineup?matchId=${encodeURIComponent(DEMO_MATCH_ID_LIVE)}`;

export const DEMO_TOUR_STATIONS: readonly DemoTourStation[] = [
  {
    id: 'create_training',
    chapterId: 'planen',
    chapterLabel: 'Planen',
    title: 'Training anlegen',
    body: 'Lege ein Training an und stelle alle Informationen zentral für das Team bereit.',
    benefit: 'Dein Vorteil: Alle sehen denselben aktuellen Termin.',
    path: '/demo/tour/create-training',
    primaryActionLabel: 'Training speichern',
    primaryAction: 'save_training',
  },
  {
    id: 'parent_training_rsvp',
    chapterId: 'planen',
    chapterLabel: 'Planen',
    title: 'Elternantwort',
    body: 'Eltern sagen direkt beim Termin zu oder ab.',
    benefit:
      'Dein Vorteil: Du musst Rückmeldungen nicht mehr aus WhatsApp-Nachrichten zusammensuchen.',
    path: '/demo/tour/parent-training',
    primaryActionLabel: 'Dabei auswählen',
    primaryAction: 'parent_yes_training',
  },
  {
    id: 'training_attendance',
    chapterId: 'planen',
    chapterLabel: 'Planen',
    title: 'Trainingsbeteiligung',
    body: 'Du siehst sofort, wie viele Spieler beim Training dabei sind.',
    benefit:
      'Dein Vorteil: Du kannst Gruppen, Übungen und Material passend zur Teilnehmerzahl vorbereiten.',
    path: '/demo/team?tab=training',
    primaryActionLabel: 'Training planen',
    primaryAction: 'advance',
  },
  {
    id: 'training_plan',
    chapterId: 'planen',
    chapterLabel: 'Planen',
    title: 'Trainingsplanung',
    body: 'Plane dein Training auf Grundlage der erwarteten Teilnehmerzahl.',
    benefit: 'Dein Vorteil: Die Einheit passt besser zur tatsächlichen Mannschaftsstärke.',
    path: `/demo/events/${DEMO_TRAINING_EVENT_ID}`,
    primaryActionLabel: 'Spiel anlegen',
    primaryAction: 'advance',
  },
  {
    id: 'create_match',
    chapterId: 'spielen',
    chapterLabel: 'Spielen',
    title: 'Spiel anlegen',
    body: 'Lege den Spieltermin einmal zentral für alle an.',
    benefit: 'Dein Vorteil: Beginn, Treffpunkt und Spielort sind für alle eindeutig.',
    path: '/demo/tour/create-match',
    primaryActionLabel: 'Spiel speichern',
    primaryAction: 'save_match',
  },
  {
    id: 'parent_match_rsvp',
    chapterId: 'spielen',
    chapterLabel: 'Spielen',
    title: 'Elternantwort zum Spiel',
    body: 'Eltern melden die Verfügbarkeit direkt beim Spiel.',
    benefit: 'Dein Vorteil: Du weißt frühzeitig, mit welchen Spielern du rechnen kannst.',
    path: '/demo/tour/parent-match',
    primaryActionLabel: 'Dabei auswählen',
    primaryAction: 'parent_yes_match',
  },
  {
    id: 'match_fixture',
    chapterId: 'spielen',
    chapterLabel: 'Spielen',
    title: 'Spieltermin und Anfahrt',
    body: 'Alle wichtigen Informationen sind direkt beim Spiel gespeichert.',
    benefit: 'Dein Vorteil: Weniger Rückfragen zu Treffpunkt, Beginn und Anfahrt.',
    path: `/demo/events/${DEMO_LOOSDORF_EVENT_ID}`,
    primaryActionLabel: 'Match vorbereiten',
    primaryAction: 'show_directions',
  },
  {
    id: 'match_prep',
    chapterId: 'spielen',
    chapterLabel: 'Spielen',
    title: 'Matchkader',
    body: 'Stelle den Matchkader anhand der Rückmeldungen zusammen.',
    benefit:
      'Dein Vorteil: Verfügbarkeit und Beteiligung unterstützen eine schnelle, nachvollziehbare Auswahl.',
    path: PREP_PATH,
    primaryActionLabel: 'Aufstellung öffnen',
    primaryAction: 'advance',
  },
  {
    id: 'lineup',
    chapterId: 'spielen',
    chapterLabel: 'Spielen',
    title: 'Aufstellung',
    body: 'Plane Startformation und Bank direkt am Spielfeld.',
    benefit:
      'Dein Vorteil: Vor dem Anpfiff ist klar, wer startet und wer zunächst auf der Bank sitzt.',
    path: LINEUP_PATH,
    primaryActionLabel: 'LIVE starten',
    primaryAction: 'advance',
  },
  {
    id: 'live',
    chapterId: 'begleiten',
    chapterLabel: 'Begleiten',
    title: 'LIVE-Spiel',
    body: 'Erfasse Tore, Wechsel und Spielzeiten direkt während des Spiels.',
    benefit:
      'Dein Vorteil: Alle Matchdaten entstehen während des Spiels und müssen später nicht erneut eingegeben werden.',
    path: LIVE_PATH,
    primaryActionLabel: 'Demo-Spiel beenden',
    primaryAction: 'end_match',
  },
  {
    id: 'playtime',
    chapterId: 'begleiten',
    chapterLabel: 'Begleiten',
    title: 'Spielzeiten je Kind',
    body: 'Nach dem Abpfiff werden Ergebnis, Ereignisse und Einsatzzeiten zusammengeführt.',
    benefit: 'Dein Vorteil: Du kannst nachvollziehen, wie lange jedes Kind gespielt hat.',
    path: LIVE_PLAYTIME_PATH,
    primaryActionLabel: 'Siegerpost ansehen',
    primaryAction: 'show_winner_preview',
  },
  {
    id: 'winner_post',
    chapterId: 'auswerten',
    chapterLabel: 'Auswerten',
    title: 'Siegerpost',
    body: 'Aus den bereits erfassten Matchdaten entsteht eine fertige Ergebnisvorschau.',
    benefit:
      'Dein Vorteil: Keine doppelte Eingabe von Ergebnis, Torschützen und Spielereignissen.',
    path: LIVE_PLAYTIME_PATH,
    primaryActionLabel: 'Chronik öffnen',
    primaryAction: 'advance',
  },
  {
    id: 'chronicle',
    chapterId: 'auswerten',
    chapterLabel: 'Auswerten',
    title: 'Chronik',
    body: 'Trainings, Spiele, Ergebnisse und Mannschaftsmomente bleiben als Verlauf erhalten.',
    benefit:
      'Dein Vorteil: Du findest den gesamten Mannschaftsalltag später wieder und verlierst keine Saisonmomente.',
    path: '/demo/tour/chronicle',
    primaryActionLabel: 'Saisonbilanz ansehen',
    primaryAction: 'advance',
  },
  {
    id: 'season_review',
    chapterId: 'auswerten',
    chapterLabel: 'Auswerten',
    title: 'Saisonbilanz',
    body: 'Am Saisonende erkennst du Beteiligung, Einsätze und Spielzeiten jedes Kindes auf einen Blick.',
    benefit:
      'Dein Vorteil: Entscheidungen werden nachvollziehbarer und die Entwicklung bleibt über die Saison erhalten.',
    path: '/demo/tour/season',
    primaryActionLabel: 'Rundgang abschließen',
    primaryAction: 'finish',
  },
] as const;

export const DEMO_TOUR_FINISH = {
  title:
    'Geschafft! Du hast einen kompletten Traineralltag mit SpielzeitApp begleitet – vom Trainingstermin bis zur Saisonbilanz.',
  body: 'Alle Änderungen waren ausschließlich lokal in deiner Demo.',
  benefits: [
    'weniger WhatsApp-Chaos',
    'weniger Rückfragen',
    'bessere Trainingsplanung',
    'frühzeitige Verfügbarkeit',
    'schnellerer Matchkader',
    'vorbereitete Aufstellung',
    'LIVE erfasste Tore und Wechsel',
    'transparente Spielzeiten je Kind',
    'gespeicherte Chronik',
    'vollständiger Saisonüberblick',
  ],
} as const;

export const DEMO_TOUR_END_MATCH_CONFIRM =
  'Das Demo-Spiel wird lokal abgeschlossen. Es werden keine echten Daten veröffentlicht.';

export const DEMO_TOUR_WINNER_DISCLAIMER = 'Demo-Vorschau – wird nicht veröffentlicht';

export const DEMO_TOUR_STATION_COUNT = DEMO_TOUR_STATIONS.length;

export const DEMO_TOUR_WELCOME_HEADLINE = 'DEIN TEAM. EINFACH DURCH DIE GANZE SAISON.';

export const DEMO_TOUR_WELCOME_PROBLEM =
  'Termine in WhatsApp, Rückmeldungen in verschiedenen Gruppen und Spielzeiten im Kopf? SpielzeitApp bringt den gesamten Mannschaftsalltag an einen Ort.';

export const DEMO_TOUR_WELCOME_BENEFIT =
  'Du weißt frühzeitig, wer bei Training und Spiel dabei ist, kannst besser planen und behältst Beteiligung, Spielzeiten und die gesamte Saison im Blick.';

export const DEMO_TOUR_WELCOME_PRIMARY = 'Kompletten Traineralltag erleben';

export const DEMO_TOUR_WHAT_TAGLINE =
  'Einmal erfassen – gemeinsam organisieren – über die ganze Saison nachvollziehen.';

export const DEMO_TOUR_WHAT_POINTS = [
  'Termine und Rückmeldungen',
  'Training und Matchplanung',
  'Aufstellung und LIVE-Spiel',
  'Spielzeiten, Chronik und Saisonbilanz',
] as const;

/** Kapitel-Fortschritt für Overlay (1-basiert innerhalb des Kapitels). */
export function getDemoTourChapterProgress(stepIndex: number): {
  chapterId: DemoTourChapterId;
  chapterLabel: string;
  stepInChapter: number;
  stepsInChapter: number;
  chapterIndex: number;
} {
  const station = DEMO_TOUR_STATIONS[Math.max(0, Math.min(DEMO_TOUR_STATION_COUNT - 1, stepIndex))];
  const chapterId = station?.chapterId ?? 'planen';
  const chapterLabel = station?.chapterLabel ?? 'Planen';
  const inChapter = DEMO_TOUR_STATIONS.filter((s) => s.chapterId === chapterId);
  const stepInChapter = Math.max(1, inChapter.findIndex((s) => s.id === station?.id) + 1);
  const chapters: DemoTourChapterId[] = ['planen', 'spielen', 'begleiten', 'auswerten'];
  return {
    chapterId,
    chapterLabel,
    stepInChapter,
    stepsInChapter: inChapter.length,
    chapterIndex: Math.max(0, chapters.indexOf(chapterId)),
  };
}
