import {
  countFinishedTournamentSlots,
  pickNextOpenTournamentSlot,
  pickOrchestratorFocus,
} from './tournamentDayOrchestrator';
import { isTournamentSlotPreparable, type TournamentMatchSlotView } from './tournamentPlan';
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

function matchPrepSubDetail(slot: TournamentMatchSlotView, lineupReady: boolean): string[] {
  if (lineupReady) return ['Aufstellung fertig — als Nächstes Live starten.'];
  if (slot.has_lineup) return ['Startelf vervollständigen', 'Bank und Positionen prüfen'];
  return ['Aufstellung festlegen', 'Bank wählen', 'Positionen zuweisen'];
}

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
      title: 'Turnier abschließen',
      description: 'Alle Spiele sind durch — jetzt Abschluss und Bericht.',
      detailLines: lines,
      primaryLabel: canCompleteTournament ? 'Turnier abschließen' : canCreateReport ? 'Turnierbericht erstellen' : 'Status ansehen',
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
        title: 'Aufstellung vom letzten Spiel übernehmen',
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
        title: isFirst ? 'Erstes Spiel vorbereiten' : 'Nächstes Spiel vorbereiten',
        description: 'Aufstellung vervollständigen, dann Live starten.',
        detailLines: matchPrepSubDetail(nextSlot, lineupReady),
        primaryLabel: 'Aufstellung öffnen',
        action: { kind: 'open_lineup', matchId, isFirstMatch: isFirst },
        priorStepsDone: stepNumber - 1,
      };
    }

    if (canPrepare) {
      return {
        stepNumber,
        totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
        title: isFirst ? 'Erstes Spiel vorbereiten' : 'Nächstes Spiel vorbereiten',
        description: isFirst
          ? 'Aufstellung, Bank und Positionen für das erste Turnierspiel festlegen.'
          : 'Nächstes Turnierspiel vorbereiten — danach Live starten.',
        detailLines: matchPrepSubDetail(nextSlot, lineupReady),
        primaryLabel: isFirst ? 'Erstes Spiel vorbereiten' : 'Nächstes Spiel vorbereiten',
        action: { kind: 'prepare_match', matchId, isFirstMatch: isFirst },
        priorStepsDone: stepNumber - 1,
      };
    }
  }

  if (!availabilityDone(attendance)) {
    return {
      stepNumber: 1,
      totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
      title: 'Verfügbarkeit prüfen',
      description: 'Zusagen und Absagen der Spieler für den Turniertag erfassen.',
      detailLines: [`${attendance.openCount} Spieler ohne Rückmeldung`],
      primaryLabel: 'Jetzt öffnen',
      action: { kind: 'open_attendance' },
      priorStepsDone: 0,
    };
  }

  if (tournamentSquadCount === 0) {
    return {
      stepNumber: 2,
      totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
      title: 'Turnierkader festlegen',
      description: 'Spieler für das Turnier auswählen und Turnierkader speichern.',
      detailLines: ['Nominierte Spieler stehen in allen Turnierspielen zur Verfügung.'],
      primaryLabel: 'Jetzt öffnen',
      action: { kind: 'open_squad' },
      priorStepsDone: 1,
    };
  }

  if (!planDone(hasOfficialPlanUrl, slots)) {
    return {
      stepNumber: 3,
      totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
      title: 'Turnierplan vorbereiten',
      description: 'Turnierplan importieren oder Turnierspiele manuell anlegen.',
      detailLines: ['Offiziellen Plan verknüpfen oder Spiele einzeln hinzufügen'],
      primaryLabel: hasOfficialPlanUrl ? 'Turnierspiele anlegen' : 'Turnierplan importieren',
      action: hasOfficialPlanUrl ? { kind: 'add_match' } : { kind: 'import_plan' },
      priorStepsDone: 2,
    };
  }

  if (slots.length === 0) {
    return {
      stepNumber: 3,
      totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
      title: 'Turnierplan vorbereiten',
      description: 'Noch keine Turnierspiele — Plan importieren oder Spiele anlegen.',
      detailLines: [],
      primaryLabel: 'Turnierspiel hinzufügen',
      action: { kind: 'add_match' },
      priorStepsDone: 2,
    };
  }

  return {
    stepNumber: 4,
    totalSteps: TOURNAMENT_ASSISTANT_TOTAL_STEPS,
    title: 'Erstes Spiel vorbereiten',
    description: 'Mit der Spielvorbereitung starten.',
    detailLines: matchPrepSubDetail(slots[0], lineupReady),
    primaryLabel: 'Erstes Spiel vorbereiten',
    action: {
      kind: 'prepare_match',
      matchId: nextSlot?.match_id ?? slots[0]?.match_id,
      isFirstMatch: true,
    },
    priorStepsDone: 3,
  };
}
