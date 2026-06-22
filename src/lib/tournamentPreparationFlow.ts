import {
  isTournamentSlotPreparable,
  tournamentMatchDisplayStatus,
  type TournamentMatchSlotView,
} from './tournamentPlan';
import { isMatchPreparationAccessible } from './matchPreparationAccess';
import type { TournamentMatchSlotView } from './tournamentPlan';

function pickFeaturedSlot(slots: TournamentMatchSlotView[]): TournamentMatchSlotView | null {
  const live = slots.find((s) => (s.match_status ?? '').toLowerCase() === 'live');
  if (live) return live;
  const open = slots
    .filter((s) => (s.match_status ?? '').toLowerCase() !== 'finished')
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
  return open[0] ?? null;
}

export type PreparationCheckId =
  | 'plan'
  | 'participants'
  | 'matches'
  | 'availability'
  | 'squad'
  | 'match_ready';

export type PreparationCheckStatus = 'done' | 'pending' | 'optional';

export type PreparationCheckItem = {
  id: PreparationCheckId;
  label: string;
  status: PreparationCheckStatus;
  hint: string;
};

export type PreparationPrimaryAction =
  | { kind: 'import_plan'; label: 'Turnierplan importieren' }
  | { kind: 'add_participants'; label: 'Teilnehmer hinzufügen' }
  | { kind: 'add_match'; label: 'Turnierspiel hinzufügen' }
  | { kind: 'check_attendance'; label: 'Verfügbarkeit prüfen' }
  | { kind: 'set_squad'; label: 'Turnierkader festlegen'; matchId: string }
  | { kind: 'prepare_match'; label: 'Erstes Spiel vorbereiten'; matchId: string }
  | { kind: 'open_lineup'; label: 'Aufstellung öffnen'; matchId: string }
  | { kind: 'start_live'; label: 'Live starten'; matchId: string }
  | { kind: 'live_match'; label: 'Zum Live-Spiel'; matchId: string }
  | { kind: 'ready'; label: 'Turnier vorbereitet' };

export type TournamentAttendanceSummary = {
  playerCount: number;
  yesCount: number;
  noCount: number;
  openCount: number;
};

export type TournamentPreparationInput = {
  hasOfficialPlanUrl: boolean;
  participantCount: number;
  slots: TournamentMatchSlotView[];
  attendance: TournamentAttendanceSummary;
  lineupReady: boolean;
};

export function computeTournamentPreparationChecks(
  input: TournamentPreparationInput,
): PreparationCheckItem[] {
  const { hasOfficialPlanUrl, participantCount, slots, attendance, lineupReady } = input;
  const featured = pickFeaturedSlot(slots);
  const matchId = featured?.match_id?.trim() ?? '';
  const hasMatches = slots.length > 0;
  const hasPlan = hasOfficialPlanUrl || hasMatches;
  const hasSquad = Boolean(featured?.has_squad);
  const hasLineup = Boolean(featured?.has_lineup);
  const displayStatus = featured ? tournamentMatchDisplayStatus(featured) : null;
  const isLive = displayStatus?.kind === 'live';
  const availabilityDone =
    attendance.playerCount === 0 || attendance.openCount === 0;
  const matchReady =
    isLive ||
    lineupReady ||
    hasLineup ||
    displayStatus?.kind === 'result';

  return [
    {
      id: 'plan',
      label: 'Turnierplan vorhanden',
      status: hasPlan ? 'done' : 'pending',
      hint: hasPlan
        ? hasOfficialPlanUrl
          ? 'Offizieller Plan verknüpft oder Spiele importiert.'
          : 'Spiele im Turnierplan hinterlegt.'
        : 'Turnierplan verknüpfen oder importieren.',
    },
    {
      id: 'participants',
      label: 'Teilnehmer vorhanden',
      status: participantCount > 0 ? 'done' : 'pending',
      hint:
        participantCount > 0
          ? `${participantCount} Team${participantCount === 1 ? '' : 's'} im Turnier.`
          : 'Mindestens ein Teilnehmer-Team erfassen.',
    },
    {
      id: 'matches',
      label: 'Eigene Spiele vorhanden',
      status: hasMatches ? 'done' : 'pending',
      hint: hasMatches
        ? `${slots.length} Turnierspiel${slots.length === 1 ? '' : 'e'} geplant.`
        : 'Erstes Turnierspiel anlegen oder importieren.',
    },
    {
      id: 'availability',
      label: 'Verfügbarkeit geprüft',
      status: availabilityDone ? 'done' : 'pending',
      hint: availabilityDone
        ? attendance.playerCount === 0
          ? 'Kein Kader — Zu-/Absagen entfällt.'
          : 'Alle Spieler haben Zusage oder Absage.'
        : `${attendance.openCount} Spieler ohne Rückmeldung.`,
    },
    {
      id: 'squad',
      label: 'Turnierkader festgelegt',
      status: !matchId ? 'optional' : hasSquad ? 'done' : 'pending',
      hint: !matchId
        ? 'Nach dem ersten Spiel in der Match-Vorbereitung.'
        : hasSquad
          ? 'Kader für das nächste Spiel nominiert.'
          : 'Kader in der Match-Vorbereitung festlegen.',
    },
    {
      id: 'match_ready',
      label: 'Nächstes Spiel bereit',
      status: !matchId ? 'optional' : matchReady ? 'done' : 'pending',
      hint: !matchId
        ? 'Sobald ein Turnierspiel existiert.'
        : isLive
          ? 'Spiel läuft gerade.'
          : lineupReady
            ? 'Aufstellung komplett — Live starten möglich.'
            : hasLineup
              ? 'Aufstellung begonnen — Startelf vervollständigen.'
              : 'Spiel in der Match-Vorbereitung vorbereiten.',
    },
  ];
}

export function resolveTournamentPrimaryAction(
  input: TournamentPreparationInput,
): PreparationPrimaryAction {
  const { hasOfficialPlanUrl, participantCount, slots, attendance, lineupReady } = input;
  const featured = pickFeaturedSlot(slots);
  const matchId = featured?.match_id?.trim() ?? '';
  const displayStatus = featured ? tournamentMatchDisplayStatus(featured) : null;
  const isLive = displayStatus?.kind === 'live';
  const canPrepare =
    Boolean(matchId) &&
    !isLive &&
    isTournamentSlotPreparable(featured!) &&
    isMatchPreparationAccessible(featured?.match_status);

  if (isLive && matchId) {
    return { kind: 'live_match', label: 'Zum Live-Spiel', matchId };
  }

  if (!hasOfficialPlanUrl && slots.length === 0) {
    return { kind: 'import_plan', label: 'Turnierplan importieren' };
  }

  if (participantCount === 0) {
    return { kind: 'add_participants', label: 'Teilnehmer hinzufügen' };
  }

  if (slots.length === 0) {
    return { kind: 'add_match', label: 'Turnierspiel hinzufügen' };
  }

  if (attendance.playerCount > 0 && attendance.openCount > 0) {
    return { kind: 'check_attendance', label: 'Verfügbarkeit prüfen' };
  }

  if (matchId && !featured?.has_squad) {
    return { kind: 'set_squad', label: 'Turnierkader festlegen', matchId };
  }

  if (lineupReady && matchId) {
    return { kind: 'start_live', label: 'Live starten', matchId };
  }

  if (featured?.has_lineup && matchId) {
    return { kind: 'open_lineup', label: 'Aufstellung öffnen', matchId };
  }

  if (canPrepare && matchId) {
    return { kind: 'prepare_match', label: 'Erstes Spiel vorbereiten', matchId };
  }

  return { kind: 'ready', label: 'Turnier vorbereitet' };
}

export function countPreparationDone(items: PreparationCheckItem[]): number {
  return items.filter((item) => item.status === 'done').length;
}
