/**
 * Saisonplan-PDF – Architekturvorbereitung (STEP 7B.4.2).
 *
 * Noch kein vollständiger Export. Meisterschaftsspielplan bleibt getrennt
 * (`championshipPdf.ts`). Später: veröffentlichte Meisterschaft + Vorbereitung
 * + Turniere (Trainings optional/opt-in).
 */
import type { ChampionshipFixture } from './championshipFixtures';

export type SeasonPlanEventKind = 'championship' | 'friendly' | 'tournament' | 'training';

export type SeasonPlanRow = {
  id: string;
  kind: SeasonPlanEventKind;
  starts_at: string;
  meeting_at: string | null;
  location: string | null;
  /** Anzeige „Termin“-Spalte (Begegnung / Turniertitel / Vorbereitung). */
  title: string;
  /** Nur Meisterschaft/Vorbereitung – Turniere ohne H/A-Zwang. */
  is_home?: boolean | null;
  opponent?: string | null;
};

export type SeasonPlanPdfOptions = {
  teamName: string;
  ageGroup?: string | null;
  seasonName?: string | null;
  teamLogoUrl?: string | null;
  /** Default false — Trainings nur bei bewusster Auswahl. */
  includeTrainings?: boolean;
  rows: SeasonPlanRow[];
};

/** Filter-Hinweise für spätere Aggregation aus events. */
export function seasonPlanIncludeDefaults() {
  return {
    championshipPublishedOnly: true,
    preparationGames: true,
    tournaments: true,
    trainings: false,
  } as const;
}

/**
 * Platzhalter: Zeilen aus Championship-Fixtures ableiten (nur Liga).
 * Vollständige Aggregation (Vorbereitung/Turnier) folgt in einem späteren Step.
 */
export function championshipFixturesToSeasonPlanRows(
  fixtures: ChampionshipFixture[],
  ourTeamName: string,
): SeasonPlanRow[] {
  return fixtures
    .filter((f) => f.fixture_status === 'published')
    .map((f) => {
      const us = (ourTeamName || 'Heim').trim() || 'Heim';
      const them = (f.opponent || 'Gegner').trim() || 'Gegner';
      const title = f.is_home ? `${us} – ${them}` : `${them} – ${us}`;
      return {
        id: f.id,
        kind: 'championship' as const,
        starts_at: f.starts_at,
        meeting_at: f.meeting_at,
        location: f.location,
        title,
        is_home: f.is_home,
        opponent: f.opponent,
      };
    });
}

/**
 * Noch nicht implementiert — bewusst kein Download.
 * Rufer sollen den Meisterschaftsspielplan (`downloadChampionshipSchedulePdf`) nutzen.
 */
export async function downloadSeasonPlanPdf(
  _opts: SeasonPlanPdfOptions,
): Promise<{ error: string; filename: null }> {
  return {
    error:
      'Saisonplan-PDF folgt in einem späteren Step. Bitte vorerst den Meisterschaftsspielplan nutzen.',
    filename: null,
  };
}
