import type { TrainingExerciseRow } from '../lib/trainingExercises';
import type { TrainingSessionExerciseRow, TrainingSessionRow } from '../lib/trainingSessions';
import type { TrainingPhase } from '../lib/trainingPhases';

// Only the selected video examination unit. Training contents and sketches come
// from the supplied teaching materials; team, trainer and date are fictional.
// Never publish the original PDF with its personal/team header.
const specs: Array<{
  title: string; phase: TrainingPhase; focus: TrainingExerciseRow['focus']; minutes: number;
  organization: string; description: string; materials: string; coaching: string; short: string;
}> = [
  {
    title: 'Warm-Up mit Ball an 2 Dummies', phase: 'AW', focus: 'passspiel', minutes: 15,
    organization: 'Pro Station 2 Hütchen mit ca. 10 m Abstand aufstellen. Dummies markieren die Mitte. Pro Station maximal 6 Spieler einteilen; die Stationenzahl richtet sich nach der Spieleranzahl.',
    description: 'Ablauf 1 (links): B startet am Hütchen, läuft zwischen die Dummies in Richtung A. A spielt einen Pass, B klatscht direkt zurück. B läuft zurück zum Hütchen und läuft erneut zu A. A passt den zweiten Ball etwas früher, B nimmt ihn seitlich um einen Dummy mit und dribbelt zu Position A. A wechselt ohne Ball auf Position B. Seiten regelmäßig tauschen.\n\nAblauf 2 (rechts): B startet am Hütchen, läuft zwischen die Dummies in Richtung A. A spielt einen Pass, B klatscht direkt zurück. Nach dem ersten Klatschball läuft B seitlich-rückwärts durch die Hürden, kehrt zu den Dummies zurück, erhält ein weiteres Zuspiel, nimmt den Ball seitlich um einen Dummy mit und dribbelt zu Position A. A wechselt ohne Ball auf Position B.',
    materials: 'Bälle, Dummies, Hütchen, Hürden.',
    coaching: 'Anspielqualität und Timing von Spieler A.\nErster Kontakt in Spielrichtung.\nSaubere technische Ausführung.',
    short: 'Aufbau: Je Station 2 Hütchen im Abstand von ca. 10 m, dazwischen Dummies; maximal 6 Spieler.\nAblauf: B läuft zu A, lässt klatschen und kehrt zum Hütchen zurück. Beim zweiten Zuspiel nimmt B den Ball seitlich um den Dummy mit zu A. A wechselt ohne Ball zu B. Seiten tauschen.\nVariation: Nach dem Klatschball seitlich-rückwärts durch die Hürden laufen, zum Dummy zurückkehren und das nächste Zuspiel seitlich mitnehmen.',
  },
  {
    title: 'Pass-Wettbewerb auf Minitore mit Verteidigungsaktion', phase: 'HT1', focus: 'passspiel', minutes: 20,
    organization: '2 Teams bilden, je eine identische Pass-Station. Beide Mannschaften treten im Wettkampf gegeneinander an: Welches Team erzielt in einem Zeitabschnitt die meisten Treffer? Die Position A am Startpunkt mit Ball besetzen. Die Positionen B und C an den Dummies einfach ohne Ball besetzen. Dazu auf der Verteidigungslinie der anderen Gruppe einen fixen Verteidiger bestimmen.',
    description: 'Der Verteidiger verteidigt die Aktion. Spieler A spielt zu B, der sich seitlich vom Dummy absetzt. B spielt zu C. Dieser schließt vor der Abschlusslinie ab. Der Verteidiger darf sich auf der Verteidigungslinie bewegen und versuchen, den Schuss zu blocken und den Torerfolg zu verhindern. Alle Spieler rutschen nach der Aktion eine Position weiter.',
    materials: 'Bälle, Hütchen, Überzieher, 4 Minitore, Dummies.',
    coaching: 'Trotz Wettkampf auf eine saubere technische Ausführung in der Passform achten.',
    short: 'Aufbau: 2 identische Passstationen mit Positionen A, B, C, je 2 Minitoren und einem Verteidiger auf der Linie aufbauen.\nAblauf: A passt zu B, B löst sich seitlich vom Dummy und spielt zu C. C schließt vor der Abschlusslinie ab. Der Verteidiger darf den Schuss auf seiner Linie blocken. Nach jeder Aktion eine Position weiterrücken. Die Teams spielen auf Zeit um die meisten Treffer.',
  },
  {
    title: 'Torabschlusswettkampf im Strafraum', phase: 'HT2', focus: 'torschuss', minutes: 20,
    organization: 'Mittig auf der Grundlinie ein Tor postieren und mit Torhütern besetzen. Mit Hütchen auf der 5-Meter-Linie – jeweils vom 5-Meter-Eck aus – auf die Strafraumlinie einen Dummy postieren.',
    description: 'Ablauf 1 (links): Spieler A spielt einen Pass auf B. B setzt sich ab, nimmt den Ball hinter dem Dummy in Richtung Tor mit und schließt ab. Abschluss vor der Torschusslinie. Team Rot mit rechts, Team Blau mit links. Nach der Aktion wechselt A auf Position B, holt den Ball und stellt sich bei A an. Die Teams schießen abwechselnd, Blau startet. Nach einer gewissen Zeit Seitenwechsel und als Wettkampf ausspielen.\n\nAblauf 2 (rechts): Doppelpass um den Dummy: A passt, B lässt klatschen, A spielt den Doppelpass, B schließt ab. Jedes Team macht Ablauf 1 und 2. Das Team gewinnt, welches mehr Tore erzielt.',
    materials: 'Bälle, Hütchen, Tor, Dummies, Überzieher.',
    coaching: 'Anspielschärfe.\nErster Kontakt nach innen Richtung Tor.\nPlatzierten Abschluss anstreben.\nSchneller Abschluss.',
    short: 'Aufbau: Tor mit Torhütern auf der Grundlinie, Hütchen an beiden Fünfmeterecken, Dummy an der Strafraumlinie.\nAblauf 1: A passt zu B. B löst sich, nimmt hinter dem Dummy Richtung Tor mit und schließt vor der Torschusslinie ab. Rot mit rechts, Blau mit links. Positionen und Seiten wechseln; abwechselnd abschließen.\nAblauf 2: A passt zu B, B lässt klatschen, A spielt den Doppelpass und B schließt ab. Beide Teams absolvieren beide Abläufe. Die meisten Tore gewinnen.',
  },
  {
    title: '2vs2+4 Torschuss-Spielform mit Umschalten auf 1 Tor', phase: 'AK', focus: 'umschalten', minutes: 20,
    organization: 'Ca. 28 Meter breites Spielfeld im Strafraum markieren. Mittig ein Tor postieren.',
    description: '2 Teams spielen 2vs2 gegeneinander (Rot vs. Blau). Freies Spiel ohne Abseits. Ein Team agiert als Wandspieler links und rechts neben dem Tor (hier: Grün). Der Anspieler (Gelb) steht im Teilkreis und bringt jeden neuen Ball ins Spiel. Team Blau versucht, ein Tor zu erzielen. Bei Tor oder Ausball spielt der Anspieler sofort den nächsten Ball ein. Erobert Rot als verteidigendes Team den Ball, muss der Ball erst zum Anspieler gespielt werden. Gelingt dieses Zuspiel, dreht sofort die Spielrichtung und Team Rot greift an. Nach jedem Durchgang wechseln die Mannschaften ihre Aufgaben.',
    materials: 'Bälle, Hütchen, Tor, Überzieher.',
    coaching: 'Schnellen Torabschluss fordern.\nSchnelles Umschalten.\nBeidfüßig abschließen lassen.',
    short: 'Aufbau: Ca. 28 m breites Feld im Strafraum mit einem Tor, Torhüter, 2 Wandspielern neben dem Tor und einem Anspieler im Teilkreis.\nAblauf: Rot gegen Blau im 2 gegen 2 ohne Abseits. Blau greift an. Nach Tor oder Ausball spielt der Anspieler sofort einen neuen Ball ein. Erobert Rot den Ball, zuerst zum Anspieler passen. Danach greift Rot an. Nach jedem Durchgang Aufgaben wechseln.',
  },
];

export const DEMO_DESKTOP_EXERCISES: TrainingExerciseRow[] = specs.map((s, i) => ({
  id: `desktop-demo-exercise-${i + 1}`, club_id: 'desktop-demo-club', team_id: null,
  title: s.title, description: s.description, organization: s.organization,
  focus: s.focus, suitable_phases: [s.phase], age_group: 'U12', duration_minutes: s.minutes,
  player_count_min: 12, player_count_max: 14, difficulty: 'medium',
  materials: s.materials, coaching_points: s.coaching, variations: null,
  short_content: s.short, short_materials: s.materials, short_coaching: s.coaching,
  image_path: null, source_type: 'club',
  source_reference: 'Videoeinheit aus der Trainerausbildung. Originalübungen und Originalskizzen; Mannschaft und Trainer in der Demo sind fiktiv.',
  visibility: 'club', created_by: null, is_active: true,
}));

export function createDemoDesktopSession(): TrainingSessionRow {
  return {
    id: 'desktop-demo-session', club_id: 'desktop-demo-club', team_id: 'desktop-demo-team',
    team_season_id: 'desktop-demo-season', event_id: null,
    title: 'Passspiel – Torabschluss – Umschalten',
    objective: 'Passspiel – Torabschluss – Umschalten',
    notes: 'Training aus der Trainerausbildung. Mannschaft, Trainer und Termin sind für die Demo fiktiv.',
    planned_duration_minutes: 75, status: 'draft', record_type: 'session', source_session_id: null,
    template_id: null, focus: 'passspiel', age_group: 'U12', actual_duration_minutes: null,
    completed_at: null, completed_by: null, review_rating: null, review_notes: null,
    worked_well: null, needs_improvement: null, repeat_next_time: false,
    archived_at: null, archived_by: null,
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
  return DEMO_DESKTOP_EXERCISES.map((exercise, i) => demoDesktopItem(exercise, `desktop-demo-item-${i}`, i));
}

// Byte-for-byte image extraction from the supplied training PDF. No original
// personal/team headers, child photographs or video recordings are published.
export const DEMO_DESKTOP_SKETCHES = Object.fromEntries(DEMO_DESKTOP_EXERCISES.map((e, i) => [e.id, `/demo/training-video/${['aw', 'ht1', 'ht2', 'ak'][i]}.jpeg`]));

export function orderDemoDesktopItems(items: TrainingSessionExerciseRow[]): TrainingSessionExerciseRow[] {
  const phases: TrainingPhase[] = ['AW', 'HT1', 'HT2', 'AK'];
  return [...items].sort((a, b) => phases.indexOf(a.phase) - phases.indexOf(b.phase) || a.sort_order - b.sort_order);
}
