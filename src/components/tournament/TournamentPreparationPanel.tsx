import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, ClipboardCheck, Radio } from 'lucide-react';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { fetchLineupForLiveMatch } from '../../lib/liveMatchService';
import {
  liveMatchPath,
  matchLineupPath,
  matchPreparationPath,
} from '../../lib/matchPreparationAccess';
import { dsPrimaryCtaClass, dsScheduleGlassButtonClass } from '../../lib/premiumDesignSystem';
import { isStartelfCompleteFromStartingIds } from '../../pages/MatchDetail/lineupGuards';
import {
  computeTournamentPreparationChecks,
  countPreparationDone,
  resolveTournamentPrimaryAction,
  type PreparationCheckItem,
  type PreparationPrimaryAction,
  type TournamentAttendanceSummary,
} from '../../lib/tournamentPreparationFlow';
import { fetchTournamentSquadPlayerIds } from '../../lib/tournamentSquad';
import { pickFeaturedTournamentSlot } from './tournamentCenterUtils';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  tournamentEventId: string;
  slots: TournamentMatchSlotView[];
  participantCount: number;
  hasOfficialPlanUrl: boolean;
  attendance: TournamentAttendanceSummary;
  loading?: boolean;
  onImportPlan: () => void;
  onAddMatch: () => void;
  onAddParticipants: () => void;
  onScrollToAttendance: () => void;
  onScrollToSquad: () => void;
};

function ChecklistRow({ item }: { item: PreparationCheckItem }) {
  const done = item.status === 'done';
  const optional = item.status === 'optional';

  return (
    <li className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          done
            ? 'bg-emerald-500/20 text-emerald-300'
            : optional
              ? 'bg-white/[0.06] text-white/35'
              : 'bg-amber-500/12 text-amber-300/85'
        }`}
        aria-hidden
      >
        {done ? (
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        ) : (
          <Circle className="h-2 w-2" strokeWidth={2.5} fill="currentColor" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[12px] font-semibold leading-snug ${done ? 'text-white/88' : 'text-white/75'}`}>
          {item.label}
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-white/45">{item.hint}</p>
      </div>
    </li>
  );
}

function PrimaryCta({
  action,
  onImportPlan,
  onAddMatch,
  onAddParticipants,
  onScrollToAttendance,
  onScrollToSquad,
  basePath = '/app',
}: {
  action: PreparationPrimaryAction;
  onImportPlan: () => void;
  onAddMatch: () => void;
  onAddParticipants: () => void;
  onScrollToAttendance: () => void;
  onScrollToSquad: () => void;
  basePath?: '/app' | '/demo';
}) {
  if (action.kind === 'ready') {
    return (
      <p className="rounded-xl border border-emerald-500/20 bg-emerald-950/25 px-3 py-2.5 text-center text-[12px] font-medium text-emerald-200/90">
        Turnier ist vorbereitet — du kannst mit dem nächsten Spiel starten.
      </p>
    );
  }

  const primaryClass = `${dsPrimaryCtaClass()} inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold`;
  const glassClass = `${dsScheduleGlassButtonClass()} inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold`;

  switch (action.kind) {
    case 'import_plan':
      return (
        <button type="button" className={primaryClass} onClick={onImportPlan}>
          {action.label}
        </button>
      );
    case 'add_participants':
      return (
        <button type="button" className={primaryClass} onClick={onAddParticipants}>
          {action.label}
        </button>
      );
    case 'add_match':
      return (
        <button type="button" className={primaryClass} onClick={onAddMatch}>
          {action.label}
        </button>
      );
    case 'check_attendance':
      return (
        <button type="button" className={glassClass} onClick={onScrollToAttendance}>
          {action.label}
        </button>
      );
    case 'set_squad':
      return (
        <button type="button" className={primaryClass} onClick={onScrollToSquad}>
          {action.label}
        </button>
      );
    case 'prepare_match':
      return (
        <Link to={matchPreparationPath(action.matchId, basePath)} className={primaryClass}>
          {action.label}
        </Link>
      );
    case 'open_lineup':
      return (
        <Link to={matchLineupPath(action.matchId, basePath)} className={primaryClass}>
          {action.label}
        </Link>
      );
    case 'start_live':
    case 'live_match':
      return (
        <Link to={liveMatchPath(action.matchId, basePath)} className={primaryClass}>
          <Radio
            className={`h-3.5 w-3.5${action.kind === 'live_match' ? ' animate-pulse' : ''}`}
            strokeWidth={2.25}
            aria-hidden
          />
          {action.label}
        </Link>
      );
    default:
      return null;
  }
}

export function TournamentPreparationPanel({
  tournamentEventId,
  slots,
  participantCount,
  hasOfficialPlanUrl,
  attendance,
  loading = false,
  onImportPlan,
  onAddMatch,
  onAddParticipants,
  onScrollToAttendance,
  onScrollToSquad,
}: Props) {
  const basePath = useInternalBasePath();
  const featured = pickFeaturedTournamentSlot(slots);
  const matchId = featured?.match_id?.trim() ?? '';
  const [lineupReady, setLineupReady] = useState(false);
  const [lineupLoading, setLineupLoading] = useState(false);
  const [tournamentSquadCount, setTournamentSquadCount] = useState(0);
  const [squadCountLoading, setSquadCountLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSquadCountLoading(true);
    void (async () => {
      const { data, error } = await fetchTournamentSquadPlayerIds(tournamentEventId);
      if (cancelled) return;
      setTournamentSquadCount(error ? 0 : data.length);
      setSquadCountLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentEventId, slots]);

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setLineupReady(false);
      setLineupLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLineupLoading(true);
    void (async () => {
      const { data, error } = await fetchLineupForLiveMatch(matchId);
      if (cancelled) return;
      setLineupReady(!error && isStartelfCompleteFromStartingIds(data.startingPlayerIds));
      setLineupLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const prepInput = useMemo(
    () => ({
      hasOfficialPlanUrl,
      participantCount,
      slots,
      attendance,
      lineupReady,
      tournamentSquadCount,
    }),
    [hasOfficialPlanUrl, participantCount, slots, attendance, lineupReady, tournamentSquadCount],
  );

  const checklist = useMemo(
    () => computeTournamentPreparationChecks(prepInput),
    [prepInput],
  );
  const primaryAction = useMemo(
    () => resolveTournamentPrimaryAction(prepInput),
    [prepInput],
  );
  const doneCount = countPreparationDone(checklist);

  if (loading || lineupLoading || squadCountLoading) {
    return (
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className={TC_SECTION_LABEL}>Turnier vorbereiten</p>
          <p className="mt-1.5 text-[12px] text-white/55">Lade Vorbereitung…</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${TC_CARD} border-[rgba(255,71,71,0.22)]`}>
      <div className={`${TC_CARD_INNER} flex flex-col gap-2.5`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`${TC_SECTION_LABEL} inline-flex items-center gap-1.5`}>
            <ClipboardCheck className="h-3.5 w-3.5 text-red-400/85" strokeWidth={2} aria-hidden />
            Turnier vorbereiten
          </p>
          <span className="text-[10px] font-semibold tabular-nums text-white/45">
            {doneCount}/{checklist.length}
          </span>
        </div>

        <p className="text-[11px] leading-snug text-white/55">
          Wie bei einem Spiel — nur eine Ebene darüber: Plan, Kader, erstes Spiel, dann Live.
        </p>

        <ol className="flex list-none flex-col gap-1 p-0">
          {checklist.map((item) => (
            <ChecklistRow key={item.id} item={item} />
          ))}
        </ol>

        <div className="border-t border-white/[0.06] pt-2">
          <PrimaryCta
            action={primaryAction}
            onImportPlan={onImportPlan}
            onAddMatch={onAddMatch}
            onAddParticipants={onAddParticipants}
            onScrollToAttendance={onScrollToAttendance}
            onScrollToSquad={onScrollToSquad}
            basePath={basePath}
          />
          {lineupLoading ? (
            <p className="mt-1.5 text-center text-[10px] text-white/40">Prüfe Aufstellung…</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
