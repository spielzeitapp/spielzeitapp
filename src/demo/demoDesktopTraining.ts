import type { TrainingExerciseRow } from '../lib/trainingExercises';
import type { TrainingSessionExerciseRow, TrainingSessionRow } from '../lib/trainingSessions';
import type { TrainingPhase } from '../lib/trainingPhases';

// Deliberately independent of the account, database, real clubs and imported exercises.
const specs: Array<{
  title: string; phase: TrainingPhase; focus: TrainingExerciseRow['focus']; minutes: number;
  description: string; materials: string; coaching: string;
}> = [
  { title: 'Dribbelgarten mit Richtungswechsel', phase: 'AW', focus: 'dribbling', minutes: 10,
    description: 'Ein Feld von 20 × 20 Metern markieren. Alle dribbeln mit eigenem Ball im Feld. Auf ein Signal die Richtung wechseln und anschließend einen freien Raum anlaufen.',
    materials: '12 Bälle, 8 Hütchen.', coaching: 'Blick vom Ball lösen. Mit beiden Füßen dribbeln. Abstand halten.' },
  { title: 'Passen und nachstarten', phase: 'HT1', focus: 'passspiel', minutes: 15,
    description: 'Vier Hütchen als Quadrat mit 12 Metern Seitenlänge aufstellen. Den Ball zur nächsten Station passen und dem Pass folgen. Nach fünf Minuten die Spielrichtung wechseln.',
    materials: '4 Hütchen, 3 Bälle.', coaching: 'Vor dem Pass Blickkontakt suchen. Mit dem ersten Kontakt in Spielrichtung mitnehmen.' },
  { title: 'Zwei gegen eins zum Tor', phase: 'HT2', focus: 'torschuss', minutes: 20,
    description: 'Zwei Angreifende starten gegen eine verteidigende Person auf ein Minitor. Nach jedem Angriff wechseln die Rollen. Auf zwei Feldern parallel spielen.',
    materials: '2 Minitore, 8 Hütchen, Bälle.', coaching: 'Breite herstellen. Mit Tempo andribbeln. Den freien Mitspieler erkennen.' },
  { title: 'Vier gegen vier auf vier Tore', phase: 'AK', focus: 'spielform', minutes: 15,
    description: 'Ein Feld von 30 × 25 Metern mit vier Minitoren aufbauen. Vier gegen vier spielen, die übrigen Kinder regelmäßig einwechseln. Jedes Team greift auf zwei Tore an.',
    materials: '4 Minitore, Leibchen, Bälle.', coaching: 'Freie Räume nutzen. Gemeinsam angreifen und verteidigen. Alle beteiligen.' },
  { title: 'Ballgefühl im Hütchenparcours', phase: 'AW', focus: 'ballkontrolle', minutes: 10,
    description: 'Zwei parallele Slalomwege markieren. Mit engem Ballkontakt durch den Parcours dribbeln. Am Ende wenden und außen zurückdribbeln.',
    materials: '12 Hütchen, 12 Bälle.', coaching: 'Kleine Kontakte wählen. Tempo der Aufgabe anpassen. Beide Füße einsetzen.' },
  { title: 'Drei gegen drei mit Außenspielern', phase: 'HT2', focus: 'passspiel', minutes: 20,
    description: 'In einem Feld von 20 × 25 Metern drei gegen drei spielen. Zwei neutrale Außenspieler unterstützen die ballbesitzende Mannschaft. Nach drei Minuten Rollen tauschen.',
    materials: '8 Hütchen, Leibchen, Bälle.', coaching: 'Anspielbar werden. Vororientieren. Nach dem Pass wieder freilaufen.' },
];

export const DEMO_DESKTOP_EXERCISES: TrainingExerciseRow[] = specs.map((s, i) => ({
  id: `desktop-demo-exercise-${i + 1}`, club_id: 'desktop-demo-club', team_id: null,
  title: s.title, description: s.description, focus: s.focus, suitable_phases: [s.phase],
  age_group: 'U12', duration_minutes: s.minutes, player_count_min: 8, player_count_max: 14,
  difficulty: 'easy', materials: s.materials, organization: null, coaching_points: s.coaching,
  variations: 'Abstände und Tempo an die Gruppe anpassen.', short_content: s.description,
  short_materials: s.materials, short_coaching: s.coaching, image_path: null,
  source_type: 'club', source_reference: 'Fiktive Beispielübung für die Desktop-Demo.',
  visibility: 'club', created_by: null, is_active: true,
}));

export function createDemoDesktopSession(): TrainingSessionRow {
  return {
    id: 'desktop-demo-session', club_id: 'desktop-demo-club', team_id: 'desktop-demo-team',
    team_season_id: 'desktop-demo-season', event_id: null, title: 'Gemeinsam zum Tor',
    objective: 'Freilaufen, sichere Pässe und mutige Entscheidungen im Zwei gegen eins.',
    notes: 'Beispielplanung – alle Inhalte sind fiktiv.', planned_duration_minutes: 60,
    status: 'draft', record_type: 'session', source_session_id: null, template_id: null,
    focus: 'passspiel', age_group: 'U12', actual_duration_minutes: null, completed_at: null,
    completed_by: null, review_rating: null, review_notes: null, worked_well: null,
    needs_improvement: null, repeat_next_time: false, archived_at: null, archived_by: null,
  };
}

export function demoDesktopItem(exercise: TrainingExerciseRow, id: string, order: number): TrainingSessionExerciseRow {
  return {
    id, training_session_id: 'desktop-demo-session', exercise_id: exercise.id,
    phase: exercise.suitable_phases[0], sort_order: order, duration_minutes: exercise.duration_minutes,
    coach_notes: null, was_completed: null, actual_duration_minutes: null, review_status: null,
    review_notes: null, repeat_recommended: false,
  };
}

export function createDemoDesktopItems(): TrainingSessionExerciseRow[] {
  return DEMO_DESKTOP_EXERCISES.slice(0, 4).map((exercise, i) => demoDesktopItem(exercise, `desktop-demo-item-${i}`, i));
}

/** Code-native tactical sketches, not photographs or storage objects. */
export function demoDesktopSketch(index: number): string {
  const players = index === 2 ? [[110, 105], [110, 205], [245, 155]] : [[90, 85], [90, 225], [300, 85], [300, 225]];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" rx="16" fill="#f2f7f3"/>
    <rect x="35" y="35" width="330" height="230" rx="4" fill="#dfede2" stroke="#7a9b83" stroke-width="2"/>
    <path d="M200 35v230" stroke="#fff" stroke-width="2"/><circle cx="200" cy="150" r="38" fill="none" stroke="#fff" stroke-width="2"/>
    <path d="M120 105L275 105M275 195L130 195" fill="none" stroke="#52655b" stroke-width="3" stroke-dasharray="7 5"/>
    <path d="M270 99l10 6-10 6M135 189l-10 6 10 6" fill="none" stroke="#52655b" stroke-width="3"/>
    ${players.map(([x,y], i) => `<circle cx="${x}" cy="${y}" r="13" fill="${i % 2 ? '#303c4e' : '#c92d35'}" stroke="white" stroke-width="2"/>`).join('')}
    <circle cx="135" cy="123" r="6" fill="white" stroke="#303c4e" stroke-width="2"/>
    <text x="200" y="286" text-anchor="middle" font-family="Arial" font-size="11" fill="#52655b">DEMO · Schematische Beispielskizze</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const DEMO_DESKTOP_SKETCHES = Object.fromEntries(DEMO_DESKTOP_EXERCISES.map((e, i) => [e.id, demoDesktopSketch(i)]));

export function orderDemoDesktopItems(items: TrainingSessionExerciseRow[]): TrainingSessionExerciseRow[] {
  const phases: TrainingPhase[] = ['AW', 'HT1', 'HT2', 'AK'];
  return [...items].sort((a, b) => phases.indexOf(a.phase) - phases.indexOf(b.phase) || a.sort_order - b.sort_order);
}
