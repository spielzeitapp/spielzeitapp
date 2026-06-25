import {
  isTournamentSlotPreparable,
  tournamentMatchDisplayStatus,
  type TournamentMatchSlotView,
} from './tournamentPlan';
import { isMatchPreparationAccessible } from './matchPreparationAccess';

export type TournamentOrchestratorFocus =
  | { kind: 'none' }
  | { kind: 'live'; slot: TournamentMatchSlotView }
  | { kind: 'next'; slot: TournamentMatchSlotView; priorFinishedCount: number }
  | { kind: 'last_finished'; slot: TournamentMatchSlotView };

export type TournamentOrchestratorWorkflowPhase =
  | 'no_matches'
  | 'prepare'
  | 'lineup_ready'
  | 'live'
  | 'all_finished'
  | 'archived';

export type TournamentOrchestratorCta =
  | { kind: 'add_match'; label: string; variant: 'primary' }
  | { kind: 'prepare'; matchId: string; label: string; variant: 'primary' }
  | { kind: 'open_lineup'; matchId: string; label: string; variant: 'secondary' }
  | { kind: 'start_live'; matchId: string; label: string; variant: 'primary' }
  | { kind: 'go_live'; matchId: string; label: string; variant: 'primary' }
  | { kind: 'create_report'; label: string; variant: 'secondary' }
  | { kind: 'complete_tournament'; label: string; variant: 'primary' }
  | { kind: 'show_overview'; label: string; variant: 'secondary' };

export type TournamentOrchestratorBadgeTone = 'live' | 'ready' | 'open' | 'finished' | 'neutral';

export type TournamentOrchestratorState = {
  focus: TournamentOrchestratorFocus;
  phase: TournamentOrchestratorWorkflowPhase;
  headerTitle: string;
  badgeLabel: string;
  badgeTone: TournamentOrchestratorBadgeTone;
  ctas: TournamentOrchestratorCta[];
  showLineupReadyMark: boolean;
};

export function sortTournamentSlotsChronologically(
  slots: TournamentMatchSlotView[],
): TournamentMatchSlotView[] {
  return [...slots].sort((a, b) => {
    const ta = new Date(a.kickoff_at).getTime();
    const tb = new Date(b.kickoff_at).getTime();
    if (ta !== tb) return ta - tb;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export function countFinishedTournamentSlots(slots: TournamentMatchSlotView[]): number {
  return slots.filter((s) => (s.match_status ?? '').toLowerCase() === 'finished').length;
}

export function pickNextOpenTournamentSlot(
  slots: TournamentMatchSlotView[],
): TournamentMatchSlotView | null {
  return (
    sortTournamentSlotsChronologically(slots).find(
      (s) => (s.match_status ?? '').toLowerCase() !== 'finished',
    ) ?? null
  );
}

export function pickLastFinishedTournamentSlot(
  slots: TournamentMatchSlotView[],
): TournamentMatchSlotView | null {
  const finished = sortTournamentSlotsChronologically(slots).filter(
    (s) => (s.match_status ?? '').toLowerCase() === 'finished',
  );
  return finished[finished.length - 1] ?? null;
}

/** Trainer-Featured-Card: Live → nächstes offenes Spiel → letztes beendetes Spiel. */
export function pickOrchestratorFocus(slots: TournamentMatchSlotView[]): TournamentOrchestratorFocus {
  if (slots.length === 0) return { kind: 'none' };

  const live = slots.find((s) => (s.match_status ?? '').toLowerCase() === 'live');
  if (live) return { kind: 'live', slot: live };

  const priorFinishedCount = countFinishedTournamentSlots(slots);
  const next = pickNextOpenTournamentSlot(slots);
  if (next) return { kind: 'next', slot: next, priorFinishedCount };

  const last = pickLastFinishedTournamentSlot(slots);
  if (last) return { kind: 'last_finished', slot: last };

  return { kind: 'none' };
}

/** Kompatibel mit bestehenden Aufrufern (nächstes offenes / Live-Spiel). */
export function pickFeaturedTournamentSlotFromOrchestrator(
  slots: TournamentMatchSlotView[],
): TournamentMatchSlotView | null {
  const focus = pickOrchestratorFocus(slots);
  if (focus.kind === 'none') return null;
  return focus.slot;
}

function prepareLabel(priorFinishedCount: number): string {
  if (priorFinishedCount === 0) return 'Erstes Spiel vorbereiten';
  return 'Nächstes Spiel vorbereiten';
}

function canPrepareSlot(slot: TournamentMatchSlotView): boolean {
  return (
    isTournamentSlotPreparable(slot) && isMatchPreparationAccessible(slot.match_status)
  );
}

export function resolveTournamentOrchestrator(params: {
  slots: TournamentMatchSlotView[];
  canManage: boolean;
  lineupReady: boolean;
  tournamentArchived: boolean;
  canCreateReport: boolean;
  canCompleteTournament: boolean;
}): TournamentOrchestratorState {
  const focus = pickOrchestratorFocus(params.slots);

  if (params.tournamentArchived) {
    const slot = focus.kind !== 'none' ? focus.slot : null;
    return {
      focus,
      phase: 'archived',
      headerTitle: slot ? 'Turnier abgeschlossen' : 'Turnier',
      badgeLabel: 'Archiviert',
      badgeTone: 'neutral',
      ctas: slot
        ? [{ kind: 'show_overview', label: 'Turniercenter Übersicht', variant: 'secondary' }]
        : [],
      showLineupReadyMark: false,
    };
  }

  if (focus.kind === 'none') {
    return {
      focus,
      phase: 'no_matches',
      headerTitle: 'Nächstes Turnierspiel',
      badgeLabel: 'Offen',
      badgeTone: 'open',
      ctas: params.canManage
        ? [{ kind: 'add_match', label: 'Turnierspiel hinzufügen', variant: 'primary' }]
        : [],
      showLineupReadyMark: false,
    };
  }

  const slot = focus.slot;
  const matchId = slot.match_id?.trim() ?? '';
  const display = tournamentMatchDisplayStatus(slot);

  if (focus.kind === 'live') {
    return {
      focus,
      phase: 'live',
      headerTitle: 'Live-Spiel',
      badgeLabel: 'Live',
      badgeTone: 'live',
      ctas: matchId
        ? [{ kind: 'go_live', matchId, label: 'Zum Live-Spiel', variant: 'primary' }]
        : [],
      showLineupReadyMark: false,
    };
  }

  if (focus.kind === 'last_finished') {
    const ctas: TournamentOrchestratorCta[] = [];
    if (params.canManage) {
      if (params.canCreateReport) {
        ctas.push({ kind: 'create_report', label: 'Turnierbericht erstellen', variant: 'secondary' });
      }
      if (params.canCompleteTournament) {
        ctas.push({ kind: 'complete_tournament', label: 'Turnier abschließen', variant: 'primary' });
      }
      ctas.push({ kind: 'show_overview', label: 'Turniercenter Übersicht', variant: 'secondary' });
    }
    return {
      focus,
      phase: 'all_finished',
      headerTitle: 'Letztes Spiel beendet',
      badgeLabel: 'Beendet',
      badgeTone: 'finished',
      ctas,
      showLineupReadyMark: false,
    };
  }

  // focus.kind === 'next'
  if (!params.canManage) {
    return {
      focus,
      phase: 'prepare',
      headerTitle: 'Nächstes Turnierspiel',
      badgeLabel: display.kind === 'preparation' ? 'Vorbereitung' : 'Geplant',
      badgeTone: display.kind === 'preparation' ? 'open' : 'neutral',
      ctas: [],
      showLineupReadyMark: false,
    };
  }

  if (params.lineupReady && matchId) {
    return {
      focus,
      phase: 'lineup_ready',
      headerTitle: 'Nächstes Turnierspiel',
      badgeLabel: 'Aufstellung fertig',
      badgeTone: 'ready',
      ctas: [
        { kind: 'open_lineup', matchId, label: 'Aufstellung öffnen', variant: 'secondary' },
        { kind: 'start_live', matchId, label: 'Live starten', variant: 'primary' },
      ],
      showLineupReadyMark: true,
    };
  }

  if (canPrepareSlot(slot) && matchId) {
    return {
      focus,
      phase: 'prepare',
      headerTitle: 'Nächstes Turnierspiel',
      badgeLabel: slot.has_lineup || slot.has_squad ? 'Vorbereitung' : 'Geplant',
      badgeTone: slot.has_lineup || slot.has_squad ? 'open' : 'neutral',
      ctas: [
        {
          kind: 'prepare',
          matchId,
          label: prepareLabel(focus.priorFinishedCount),
          variant: 'primary',
        },
      ],
      showLineupReadyMark: false,
    };
  }

  if (slot.has_lineup && matchId) {
    return {
      focus,
      phase: 'prepare',
      headerTitle: 'Nächstes Turnierspiel',
      badgeLabel: 'Vorbereitung',
      badgeTone: 'open',
      ctas: [{ kind: 'open_lineup', matchId, label: 'Aufstellung öffnen', variant: 'primary' }],
      showLineupReadyMark: false,
    };
  }

  return {
    focus,
    phase: 'prepare',
    headerTitle: 'Nächstes Turnierspiel',
    badgeLabel: 'Geplant',
    badgeTone: 'neutral',
    ctas: [],
    showLineupReadyMark: false,
  };
}
