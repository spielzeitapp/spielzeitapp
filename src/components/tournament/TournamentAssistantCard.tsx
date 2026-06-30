import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, ClipboardList, Loader2 } from 'lucide-react';
import { fetchLineupForLiveMatch } from '../../lib/liveMatchService';
import {
  liveMatchPath,
  matchLineupPath,
  matchPreparationPath,
} from '../../lib/matchPreparationAccess';
import { dsPrimaryCtaClass, dsScheduleGlassButtonClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { isStartelfCompleteFromStartingIds } from '../../pages/MatchDetail/lineupGuards';
import {
  resolveTournamentAssistantStep,
  type TournamentAssistantAction,
  type TournamentAssistantStep,
} from '../../lib/tournamentAssistant';
import {
  countFinishedTournamentSlots,
  pickNextOpenTournamentSlot,
} from '../../lib/tournamentDayOrchestrator';
import {
  copyTournamentLineupBetweenMatches,
  detectTournamentLineupCopyContext,
  type TournamentLineupCopyMode,
} from '../../lib/tournamentLineupCopy';
import type { TournamentAttendanceSummary } from '../../lib/tournamentPreparationFlow';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { fetchTournamentSquadPlayerIds } from '../../lib/tournamentSquad';
import { TC_CARD, TC_CARD_INNER } from './tournamentCenterStyles';

type Props = {
  tournamentEventId: string;
  slots: TournamentMatchSlotView[];
  attendance: TournamentAttendanceSummary;
  hasOfficialPlanUrl: boolean;
  loading?: boolean;
  tournamentArchived?: boolean;
  canCompleteTournament?: boolean;
  canCreateReport?: boolean;
  completingTournament?: boolean;
  onOpenAttendance: () => void;
  onOpenSquad: () => void;
  onImportPlan: () => void;
  onAddMatch: () => void;
  onCreateReport: () => void;
  onCompleteTournament: () => void;
  onViewStatus: () => void;
  onLineupCopied?: () => void;
};

function StepProgress({ step }: { step: TournamentAssistantStep }) {
  const done = step.priorStepsDone;
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-200/80">
      {done > 0 ? (
        <span className="inline-flex items-center gap-1">
          <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} aria-hidden />
          Schritt {step.stepNumber} von {step.totalSteps}
        </span>
      ) : (
        <>Schritt {step.stepNumber} von {step.totalSteps}</>
      )}
    </p>
  );
}

function PrimaryButton({
  label,
  onClick,
  disabled,
  to,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  to?: string;
}) {
  const className = `${dsPrimaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[14px] font-bold disabled:opacity-60`;
  if (to) {
    return (
      <Link to={to} className={className}>
        {label}
        <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {label}
      <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

function GlassButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${dsScheduleGlassButtonClass()} inline-flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-full px-3 py-2 text-[12px] font-semibold disabled:opacity-60`}
    >
      {label}
    </button>
  );
}

function SecondaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-full px-3 py-2 text-[12px] font-semibold disabled:opacity-60`}
    >
      {label}
    </button>
  );
}

export function TournamentAssistantCard({
  tournamentEventId,
  slots,
  attendance,
  hasOfficialPlanUrl,
  loading = false,
  tournamentArchived = false,
  canCompleteTournament = false,
  canCreateReport = false,
  completingTournament = false,
  onOpenAttendance,
  onOpenSquad,
  onImportPlan,
  onAddMatch,
  onCreateReport,
  onCompleteTournament,
  onViewStatus,
  onLineupCopied,
}: Props) {
  const [lineupReady, setLineupReady] = useState(false);
  const [lineupLoading, setLineupLoading] = useState(false);
  const [squadCount, setSquadCount] = useState(0);
  const [squadLoading, setSquadLoading] = useState(false);
  const [copyContext, setCopyContext] = useState<Awaited<ReturnType<typeof detectTournamentLineupCopyContext>>>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  const nextSlot = useMemo(() => pickNextOpenTournamentSlot(slots), [slots]);
  const focusMatchId = nextSlot?.match_id?.trim() ?? '';

  useEffect(() => {
    let cancelled = false;
    setSquadLoading(true);
    void (async () => {
      const { data, error } = await fetchTournamentSquadPlayerIds(tournamentEventId);
      if (cancelled) return;
      setSquadCount(error ? 0 : data.length);
      setSquadLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentEventId, slots]);

  useEffect(() => {
    let cancelled = false;
    if (!focusMatchId || tournamentArchived) {
      setLineupReady(false);
      setLineupLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLineupLoading(true);
    void (async () => {
      const { data, error } = await fetchLineupForLiveMatch(focusMatchId);
      if (cancelled) return;
      setLineupReady(!error && isStartelfCompleteFromStartingIds(data.startingPlayerIds));
      setLineupLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [focusMatchId, tournamentArchived, slots]);

  useEffect(() => {
    let cancelled = false;
    if (!nextSlot || tournamentArchived) {
      setCopyContext(null);
      return () => {
        cancelled = true;
      };
    }

    const priorFinished = countFinishedTournamentSlots(slots);
    if (priorFinished === 0) {
      setCopyContext(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const ctx = await detectTournamentLineupCopyContext(slots, nextSlot);
      if (!cancelled) setCopyContext(ctx);
    })();

    return () => {
      cancelled = true;
    };
  }, [slots, nextSlot, tournamentArchived]);

  const lineupCopyAvailable = Boolean(
    copyContext && (copyContext.targetLineupEmpty || copyContext.targetHasExistingLineup) && !lineupReady,
  );

  const step = useMemo(
    () =>
      resolveTournamentAssistantStep({
        slots,
        attendance,
        tournamentSquadCount: squadCount,
        hasOfficialPlanUrl,
        lineupReady,
        tournamentArchived,
        canCompleteTournament,
        canCreateReport,
        lineupCopyAvailable,
        targetHasExistingLineup: copyContext?.targetHasExistingLineup ?? false,
      }),
    [
      slots,
      attendance,
      squadCount,
      hasOfficialPlanUrl,
      lineupReady,
      tournamentArchived,
      canCompleteTournament,
      canCreateReport,
      lineupCopyAvailable,
      copyContext,
    ],
  );

  const runCopy = async (mode: TournamentLineupCopyMode, replaceExisting = false) => {
    if (!copyContext) return;
    const sourceMatchId = copyContext.sourceSlot.match_id?.trim() ?? '';
    const targetMatchId = copyContext.targetSlot.match_id?.trim() ?? '';
    if (!sourceMatchId || !targetMatchId) return;

    if (copyContext.targetHasExistingLineup && !replaceExisting && !showReplaceConfirm) {
      setShowReplaceConfirm(true);
      return;
    }

    setCopyBusy(true);
    setCopyError(null);
    const result = await copyTournamentLineupBetweenMatches({
      sourceMatchId,
      targetMatchId,
      mode,
      tournamentEventId,
      replaceExisting: replaceExisting || showReplaceConfirm || copyContext.targetHasExistingLineup,
    });
    setCopyBusy(false);

    if (result.error) {
      setCopyError(result.error);
      return;
    }

    setShowReplaceConfirm(false);
    onLineupCopied?.();
  };

  const renderAction = (action: TournamentAssistantAction) => {
    switch (action.kind) {
      case 'open_attendance':
        return <PrimaryButton label={step.primaryLabel} onClick={onOpenAttendance} />;
      case 'open_squad':
        return <PrimaryButton label={step.primaryLabel} onClick={onOpenSquad} />;
      case 'import_plan':
        return <PrimaryButton label={step.primaryLabel} onClick={onImportPlan} />;
      case 'add_match':
        return <PrimaryButton label={step.primaryLabel} onClick={onAddMatch} />;
      case 'prepare_match':
        return action.matchId ? (
          <PrimaryButton label={step.primaryLabel} to={matchPreparationPath(action.matchId)} />
        ) : null;
      case 'open_lineup':
        return action.matchId ? (
          <PrimaryButton label={step.primaryLabel} to={matchLineupPath(action.matchId)} />
        ) : null;
      case 'start_live':
      case 'go_live':
        return action.matchId ? (
          <PrimaryButton label={step.primaryLabel} to={liveMatchPath(action.matchId)} />
        ) : null;
      case 'create_report':
        return <PrimaryButton label={step.primaryLabel} onClick={onCreateReport} />;
      case 'complete_tournament':
        return (
          <PrimaryButton
            label={completingTournament ? 'Wird abgeschlossen…' : step.primaryLabel}
            onClick={onCompleteTournament}
            disabled={completingTournament}
          />
        );
      case 'view_status':
        return <PrimaryButton label={step.primaryLabel} onClick={onViewStatus} />;
      case 'lineup_copy':
        return (
          <div className="flex flex-col gap-1.5">
            {showReplaceConfirm || copyContext?.targetHasExistingLineup ? (
              <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-2.5 py-2 text-[11px] leading-snug text-amber-100/90">
                Bestehende Aufstellung wird ersetzt — Tore und Spielereignisse bleiben unberührt.
              </p>
            ) : null}
            <PrimaryButton
              label={copyBusy ? 'Wird übernommen…' : 'Komplette Aufstellung übernehmen'}
              onClick={() => void runCopy('full', showReplaceConfirm)}
              disabled={copyBusy}
            />
            <GlassButton
              label="Startelf übernehmen"
              onClick={() => void runCopy('starters', showReplaceConfirm)}
              disabled={copyBusy}
            />
            <GlassButton
              label="Bank übernehmen"
              onClick={() => void runCopy('bench', showReplaceConfirm)}
              disabled={copyBusy}
            />
            <SecondaryButton
              label="Nur Turnierkader übernehmen"
              onClick={() => void runCopy('squad_only', showReplaceConfirm)}
              disabled={copyBusy}
            />
            {action.matchId ? (
              <Link
                to={matchPreparationPath(action.matchId)}
                className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-full px-3 py-2 text-[12px] font-semibold`}
              >
                Manuell vorbereiten
              </Link>
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  if (loading || lineupLoading || squadLoading) {
    return (
      <section className={`${TC_CARD} border-[rgba(147,112,219,0.28)]`}>
        <div className={TC_CARD_INNER}>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-200/75">Turnier-Assistent</p>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-white/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Lade nächsten Schritt…
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${TC_CARD} border-[rgba(147,112,219,0.32)] shadow-[0_8px_32px_rgba(88,28,135,0.12)]`}>
      <div className={`${TC_CARD_INNER} flex flex-col gap-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-purple-200/85">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Turnier-Assistent
            </p>
            <StepProgress step={step} />
          </div>
        </div>

        <div>
          <h2 className="text-[17px] font-bold leading-snug text-white">{step.title}</h2>
          <p className="mt-1 text-[13px] leading-snug text-white/62">{step.description}</p>
          {step.detailLines.length > 0 ? (
            <ul className="mt-2 flex list-none flex-col gap-0.5 p-0">
              {step.detailLines.map((line) => (
                <li key={line} className="text-[11px] text-white/45 before:mr-1.5 before:content-['↓']">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {copyError ? (
          <p className="text-[12px] text-red-300/90" role="alert">
            {copyError}
          </p>
        ) : null}

        <div className="border-t border-white/[0.06] pt-2.5">{renderAction(step.action)}</div>

        {step.action.kind === 'complete_tournament' && canCreateReport ? (
          <SecondaryButton label="Zuerst Turnierbericht erstellen" onClick={onCreateReport} disabled={completingTournament} />
        ) : null}
      </div>
    </section>
  );
}
