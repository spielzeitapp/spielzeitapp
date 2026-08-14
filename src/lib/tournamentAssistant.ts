import {
  countFinishedTournamentSlots,
  pickNextOpenTournamentSlot,
  pickOrchestratorFocus,
  tournamentPrepareCtaLabel,
} from './tournamentDayOrchestrator';
import {
  formatTournamentKickoffTime,
  isTournamentSlotPreparable,
  type TournamentMatchSlotView,
} from './tournamentPlan';
import { isMatchPreparationAccessible } from './matchPreparationAccess';
import type { TournamentAttendanceSummary } from './tournamentPreparationFlow';

export const TOURNAMENT_ASSISTANT_TOTAL_STEPS = 7;

export type TournamentAssistantActionKind =
  | 'open_attendance'
  | 'open_squad'
  | 'import_plan'
  | 'add_match'
  | 'prepare_match'
  | 'open_lineup'
  | 'start_live'
  | 'go_live'
  | 'lineup_copy'
  | 'create_report'
  | 'complete_tournament'
  | 'view_status';

export type TournamentAssistantAction = {
  kind: TournamentAssistantActionKind;
  matchId?: string;
  sourceMatchId?: string;
  replaceExistingLineup?: boolean;
  isFirstMatch?: boolean;
};

export type TournamentAssistantStep = {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  detailLines: string[];
  primaryLabel: string;
  action: TournamentAssistantAction;
  /** Optional zweite Aktion (z. B. Plan: Import oder Spiele anlegen). */
  secondaryAction?: TournamentAssistantAction;
  secondaryLabel?: string;
  priorStepsDone: number;
};

export type TournamentAssistantInput = {
  slots: TournamentMatchSlotView[];
  attendance: TournamentAttendanceSummary;
  tournamentSquadCount: number;
  hasOfficialPlanUrl: boolean;
  lineupReady: boolean;
  tournamentArchived: boolean;
  canCompleteTournament: boolean;
  canCreateReport: boolean;
  lineupCopyAvailable: boolean;
  targetHasExistingLineup: boolean;
};

function availabilityDone(attendance: TournamentAttendanceSummary): boolean {
  return attendance.playerCount === 0 || attendance.openCount === 0;
}

function planDone(hasOfficialPlanUrl: boolean, slots: TournamentMatchSlotView[]): boolean {
  return hasOfficialPlanUrl || slots.length > 0;
}

function matchSlotDetailLines(slot: TournamentMatchSlotView): string[] {
  const timeLabel = formatTournamentKickoffTime(slot.kickoff_at);
  const pitch = String(slot.pitch ?? '').trim();
  const phase = String(slot.phase ?? '').toLowerCase();
  const phaseLabel =
    phase === 'semifinal' || phase === 'semi'
      ? 'Halbfinale'
      : phase === 'final'
        ? 'Finale'
        : phase === 'placement'
          ? 'Platzierung'
          : null;
  const lines = [
    slot.opponent_name ? `Gegner: ${slot.opponent_name}` : '',
    timeLabel ? `${timeLabel} Uhr` : '',
    pitch,
    phaseLabel,
  ].filter(Boolean);
  return lines;
}

/**
 * Nächster sinnvoller Assistenten-Schritt (Laienmodus).
 * Reihenfolge: Verfügbarkeit → Kader → Plan → Spiel vorbereiten → Live → nächstes Spiel → Abschluss.
 * Prep-Schritte 1–3 nur vor dem ersten beendeten Spiel; Live und Abschluss haben Vorrang.
 */
export function resolveTournamentAssistantStep(input: TournamentAssistantInput): TournamentAssistantStep {
  const {
    slots,
    attendance,
    tournamentSquadCount,
    hasOfficialPlanUrl,
    lineupReady,
    tournamentArchived,
    canCompleteTournament,
    canCreateReport,
    lineupCopyAvailable,
    targetHasExistingLineup,
  } = input;

  const focus = pickOrchestratorFocus(slots);
  const priorFinished = countFinishedTournamentSlots(slots);
  const nextSlot = pickNextOpenTournamentSlot(slots);
  const allFinished =
    slots.length > 0 && slots.every((s) => (s.match_status ?? '').toLowerCase() === 'finished');

  if (tournamentArchived) {
    return {
      stepNumber: 7,
      totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
      title: 'Turnier abgeschlossen',
      description: 'Das Turnier ist im Archiv — Ergebnisse und Abschluss bleiben sichtbar.',
      detailLines: ['Platzierung, Bilanz und Ergebnisse im Überblick nachsehen.'],
      primaryLabel: 'Status ansehen',
      action: { kind: 'view_status' },
      priorStepsDone: 6,
    };
  }

  if (allFinished) {
    const lines = ['Turnierbericht erstellen', 'Optional Feed-Beitrag', 'Turnier archivieren'];
    return {
      stepNumber: 7,
      totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
      title: 'Turnier beendet',
      description: 'Alle eigenen Spiele sind durch — jetzt Abschluss und Bericht.',
      detailLines: lines,
      primaryLabel: canCompleteTournament
        ? 'Turnier abschließen'
        : canCreateReport
          ? 'Turnierbericht erstellen'
          : 'Status ansehen',
      action: canCompleteTournament
        ? { kind: 'complete_tournament' }
        : canCreateReport
          ? { kind: 'create_report' }
          : { kind: 'view_status' },
      priorStepsDone: 6,
    };
  }

  if (focus.kind === 'live' && focus.slot.match_id) {
    const stepNumber = priorFinished === 0 ? 5 : 6;
    return {
      stepNumber,
      totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
      title: 'Spiel spielen',
      description: 'Live-Spiel läuft — Tore und Wechsel im Live-Modus erfassen.',
      detailLines: ['Spiel beenden, wenn der Pfiff ertönt.'],
      primaryLabel: 'Zum Live-Spiel',
      action: { kind: 'go_live', matchId: focus.slot.match_id },
      priorStepsDone: stepNumber - 1,
    };
  }

  // Vor dem ersten beendeten Spiel: Prep-Pipeline strikt führen (Laienmodus).
  if (priorFinished === 0) {
    if (!availabilityDone(attendance)) {
      return {
        stepNumber: 1,
        totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: 'Verfügbarkeit',
        description: 'Zusagen und Absagen der Spieler für den Turniertag erfassen.',
        detailLines: [
          `${attendance.yesCount} zugesagt · ${attendance.openCount} offen · ${attendance.noCount} abgesagt`,
        ],
        primaryLabel: 'Verfügbarkeit prüfen',
        action: { kind: 'open_attendance' },
        priorStepsDone: 0,
      };
    }

    if (tournamentSquadCount === 0) {
      return {
        stepNumber: 2,
        totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: 'Turnierkader',
        description: 'Spieler für das Turnier auswählen und Turnierkader speichern.',
        detailLines: ['Nur Spieler aus dem Team. Verfügbarkeit bleibt sichtbar.'],
        primaryLabel: 'Turnierkader speichern',
        action: { kind: 'open_squad' },
        priorStepsDone: 1,
      };
    }

    if (!planDone(hasOfficialPlanUrl, slots) || slots.length === 0) {
      const preferImport = !hasOfficialPlanUrl;
      return {
        stepNumber: 3,
        totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: 'Turnierplan',
        description: 'Turnierplan importieren oder Turnierspiele manuell anlegen.',
        detailLines: ['Offiziellen Plan laden oder Spiele einzeln hinzufügen'],
        primaryLabel: preferImport ? 'Turnierplan importieren' : 'Spiele manuell anlegen',
        action: preferImport ? { kind: 'import_plan' } : { kind: 'add_match' },
        secondaryLabel: preferImport ? 'Spiele manuell anlegen' : 'Turnierplan importieren',
        secondaryAction: preferImport ? { kind: 'add_match' } : { kind: 'import_plan' },
        priorStepsDone: 2,
      };
    }
  }

  if (nextSlot?.match_id) {
    const matchId = nextSlot.match_id;
    const isFirst = priorFinished === 0;
    const stepNumber = isFirst ? 4 : 6;
    const canPrepare =
      isTournamentSlotPreparable(nextSlot) && isMatchPreparationAccessible(nextSlot.match_status);

    if (lineupReady) {
      return {
        stepNumber: isFirst ? 5 : 6,
        totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: 'Live starten',
        description: isFirst
          ? 'Erstes Turnierspiel — Aufstellung steht, jetzt Live starten.'
          : 'Nächstes Turnierspiel — Aufstellung steht, jetzt Live starten.',
        detailLines: ['Spiel spielen', 'Spiel beenden'],
        primaryLabel: 'Live starten',
        action: { kind: 'start_live', matchId, isFirstMatch: isFirst },
        priorStepsDone: (isFirst ? 5 : 6) - 1,
      };
    }

    if (lineupCopyAvailable && !lineupReady && canPrepare) {
      return {
        stepNumber: 6,
        totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: 'Aufstellung übernehmen',
        description: targetHasExistingLineup
          ? 'Soll die bestehende Aufstellung ersetzt werden?'
          : 'Startelf, Bank und Positionen vom letzten Spiel übernehmen — oder neu aufstellen.',
        detailLines: ['Nur Aufstellung — keine Tore, Karten oder Wechsel'],
        primaryLabel: 'Komplette Aufstellung übernehmen',
        action: {
          kind: 'lineup_copy',
          matchId,
          sourceMatchId: undefined,
          replaceExistingLineup: targetHasExistingLineup,
          isFirstMatch: false,
        },
        priorStepsDone: 5,
      };
    }

    if (nextSlot.has_lineup && canPrepare) {
      return {
        stepNumber,
        totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: tournamentPrepareCtaLabel(nextSlot, priorFinishedCount),
        description: 'Aufstellung vervollständigen, dann Live starten.',
        detailLines: matchSlotDetailLines(nextSlot),
        primaryLabel: 'Aufstellung öffnen',
        action: { kind: 'open_lineup', matchId, isFirstMatch: isFirst },
        priorStepsDone: stepNumber - 1,
      };
    }

    if (canPrepare) {
      return {
        stepNumber,
        totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: tournamentPrepareCtaLabel(nextSlot, priorFinishedCount),
        description: isFirst
          ? 'Aufstellung, Bank und Positionen für das erste Turnierspiel festlegen.'
          : 'Nächstes Turnierspiel vorbereiten — danach Live starten.',
        detailLines: matchSlotDetailLines(nextSlot),
        primaryLabel: tournamentPrepareCtaLabel(nextSlot, priorFinishedCount),
        action: { kind: 'prepare_match', matchId, isFirstMatch: isFirst },
        priorStepsDone: stepNumber - 1,
      };
    }
  }

  // Fallback: Prep-Pipeline auch nach erstem Spiel, falls noch offen (selten).
  if (!availabilityDone(attendance)) {
    return {
      stepNumber: 1,
      totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: 'Verfügbarkeit',
        description: 'Zusagen und Absagen der Spieler für den Turniertag erfassen.',
        detailLines: [
          `${attendance.yesCount} zugesagt · ${attendance.openCount} offen · ${attendance.noCount} abgesagt`,
        ],
        primaryLabel: 'Verfügbarkeit prüfen',
      action: { kind: 'open_attendance' },
      priorStepsDone: 0,
    };
  }

  if (tournamentSquadCount === 0) {
    return {
      stepNumber: 2,
      totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: 'Turnierkader',
        description: 'Spieler für das Turnier auswählen und Turnierkader speichern.',
        detailLines: ['Nur Spieler aus dem Team. Verfügbarkeit bleibt sichtbar.'],
        primaryLabel: 'Turnierkader speichern',
      action: { kind: 'open_squad' },
      priorStepsDone: 1,
    };
  }

  if (!planDone(hasOfficialPlanUrl, slots) || slots.length === 0) {
    const preferImport = !hasOfficialPlanUrl;
    return {
      stepNumber: 3,
      totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: 'Turnierplan',
        description: 'Turnierplan importieren oder Turnierspiele manuell anlegen.',
        detailLines: ['Offiziellen Plan laden oder Spiele einzeln hinzufügen'],
        primaryLabel: preferImport ? 'Turnierplan importieren' : 'Spiele manuell anlegen',
        action: preferImport ? { kind: 'import_plan' } : { kind: 'add_match' },
        secondaryLabel: preferImport ? 'Spiele manuell anlegen' : 'Turnierplan importieren',
      secondaryAction: preferImport ? { kind: 'add_match' } : { kind: 'import_plan' },
      priorStepsDone: 2,
    };
  }

  return {
    stepNumber: 4,
    totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
    title: tournamentPrepareCtaLabel(nextSlot ?? slots[0], priorFinished),
    description: 'Mit der Spielvorbereitung starten.',
    detailLines: nextSlot ? matchSlotDetailLines(nextSlot) : [],
    primaryLabel: tournamentPrepareCtaLabel(nextSlot ?? slots[0], priorFinished),
    action: {
      kind: 'prepare_match',
      matchId: nextSlot?.match_id ?? slots[0]?.match_id,
      isFirstMatch: true,
    },
    priorStepsDone: 3,
  };
}
