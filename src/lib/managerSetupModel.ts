export type SetupKey = 'club' | 'team' | 'season' | 'staff' | 'roster' | 'access' | 'venues' | 'matches' | 'training' | 'review';
export type SetupCheck = 'open' | 'reviewed' | 'unneeded';
export type SetupSnapshot = {
  club_ready: boolean; team_ready: boolean; season_ready: boolean;
  staff: number; players: number; jerseys_missing: number; access: number;
  venues: number; matches: number; trainings: number;
  checks: Partial<Record<SetupKey, SetupCheck>>; updated_at: string | null;
};
export type SetupStep = { key: SetupKey; title: string; detail: string; present: boolean; optional: boolean; state: 'done' | 'missing' | 'review' | 'skipped' };
export function setupSteps(s: SetupSnapshot): SetupStep[] {
  const rows: Array<[SetupKey, string, string, boolean, boolean?]> = [
    ['club', 'Verein & Erscheinungsbild', 'Name, Logo und Vereinsfarben speichern und prüfen.', s.club_ready],
    ['team', 'Mannschaft zuordnen', 'Mannschaft und Verein prüfen. Zusätzliche U13 bleibt von U12 getrennt.', s.team_ready],
    ['season', 'Saison & Altersklasse', 'Aktive Saison und aktuelle Altersklasse prüfen.', s.season_ready],
    ['staff', 'Trainer zuordnen', `${s.staff} Trainer zugeordnet. Eine Einladung zählt erst nach Annahme.`, s.staff > 0],
    ['roster', 'Kader & Rückennummern', `${s.players} aktive Spieler · ${s.jerseys_missing} ohne Rückennummer. Vollständigkeit des Kaders prüfen.`, s.players > 0 && s.jerseys_missing === 0],
    ['access', 'Elternzugänge vorbereiten', `${s.access} von ${s.players} Spielern mit Elternverknüpfung oder gültiger Einladung. Spielerzugänge bei Bedarf ebenfalls prüfen.`, s.players > 0 && s.access === s.players, true],
    ['venues', 'Sportanlagen freigeben', `${s.venues} gültige Anlagenfreigaben für diese Mannschaftssaison.`, s.venues > 0],
    ['matches', 'Spielplan einrichten', `${s.matches} Spiele gespeichert. Termine, Gegner, Orte und Import-Vorschau prüfen.`, s.matches > 0, true],
    ['training', 'Trainings einrichten', `${s.trainings} Trainings gespeichert. Zeiten, Treffpunkte und Plätze prüfen.`, s.trainings > 0, true],
    ['review', 'Abschlussprüfung in der App', 'Richtige Mannschaft und Saison, Termine sowie Trainer-, Eltern- und Spieleransicht prüfen.', true],
  ];
  return rows.map(([key, title, detail, present, optional = false]) => ({ key, title, detail, present, optional,
    state: optional && s.checks[key] === 'unneeded' ? 'skipped' : !present ? 'missing' : s.checks[key] === 'reviewed' ? 'done' : 'review' }));
}
export function setupReady(s: SetupSnapshot): boolean {
  return setupSteps(s).every(step => step.state === 'done' || step.state === 'skipped');
}
