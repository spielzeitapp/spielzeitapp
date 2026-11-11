import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, ClipboardList, Loader2 } from 'lucide-react';
import { fetchMatchById, fetchLineupForLiveMatch } from '../../lib/liveMatchService';
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
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  tournamentEventId: string;
  refreshToken?: number;
  templateReady?: boolean;
  slots: TournamentMatchSlotView[];
  attendance: TournamentAttendanceSummary;
  hasOfficialPlanUrl: boolean;
  loading?: boolean;
  tournamentArchived?: boolean;
  canCompleteTournament?: boolean;
  canCreateReport?: boolean;
  completingTournament?: boolean;
  awaitingFurtherPhase?: boolean;
  refreshingPlan?: boolean;
  ownMatchCount?: number;
  totalMatchCount?: number;
  onOpenAttendance: () => void;
  onOpenSquad: () => void;
  onOpenLineup: () => void;
  onImportPlan: () => void;
  onAddMatch: () => void;
  onCreateReport: () => void;
  onCompleteTournament: () => void;
  onViewStatus: () => void;
  onRefreshPlan?: () => void;
  onLineupCopied?: () => void;
};

function StepProgress({ checks }: { checks: boolean[] }) {
  const completed = checks.filter(Boolean).length;
  return (
    <div className="mt-3">
      <p className="text-[16px] font-semibold text-white/65">{completed} von {checks.length} Vorbereitungspunkten erledigt</p>
      <div className="mt-2 flex gap-1.5" role="progressbar" aria-label="Turnier-Vorbereitung" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={completed}>
        {checks.map((done, index) => <span key={index} className={`h-2 flex-1 rounded-full ${done ? 'bg-emerald-400' : 'bg-white/15'}`} />)}
      </div>
    </div>
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
  const className = `${dsPrimaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[16px] font-bold disabled:opacity-60`;
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
      className={`${dsScheduleGlassButtonClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center rounded-full px-3 py-2 text-[15px] font-semibold disabled:opacity-60`}
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
      className={`${dsSecondaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center rounded-full px-3 py-2 text-[15px] font-semibold disabled:opacity-60`}
    >
      {label}
    </button>
  );
}

export function TournamentAssistantCard({
  tournamentEventId,
  refreshToken = 0,
  templateReady = false,
  slots,
  attendance,
  hasOfficialPlanUrl,
  loading = false,
  tournamentArchived = false,
  canCompleteTournament = false,
  canCreateReport = false,
  completingTournament = false,
  awaitingFurtherPhase = false,
  refreshingPlan = false,
  ownMatchCount = 0,
  totalMatchCount = 0,
  onOpenAttendance,
  onOpenSquad,
  onOpenLineup,
  onImportPlan,
  onAddMatch,
  onCreateReport,
  onCompleteTournament,
  onViewStatus,
  onRefreshPlan,
  onLineupCopied,
}: Props) {
  const navigate = useNavigate();
  const basePath = useInternalBasePath();
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
  }, [tournamentEventId, slots, refreshToken]);

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
      const [{ data, error }, match] = await Promise.all([fetchLineupForLiveMatch(focusMatchId), fetchMatchById(focusMatchId)]);
      if (cancelled) return;
      setLineupReady(!error && isStartelfCompleteFromStartingIds(data.startingPlayerIds, match.data?.u11_formation_id));
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
        awaitingFurtherPhase,
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
      awaitingFurtherPhase,
    ],
  );

  const runCopy = async (mode: TournamentLineupCopyMode, replaceExisting = false) => {
    if (!copyContext) return;
    const sourceMatchId = copyContext.sourceSlot.match_id?.trim() ?? '';
    const targetMatchId = copyContext.targetSlot.match_id?.trim() ?? '';
    if (!sourceMatchId || !targetMatchId) {
      setCopyError('Spiel-IDs fehlen.');
      return;
    }

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

    // Persist verifiziert in copyTournamentLineupBetweenMatches — dann erst UI öffnen.
    if (mode === 'squad_only') {
      navigate(matchPreparationPath(targetMatchId, basePath));
    } else {
      navigate(matchLineupPath(targetMatchId, basePath), {
        state: {
          formationId: result.formationId ?? undefined,
          lineupCopiedFromPrevious: true,
        },
      });
    }
  };

  const renderSingleAction = (
    action: TournamentAssistantAction,
    label: string,
    opts?: { primary?: boolean; disabled?: boolean },
  ) => {
    const primary = opts?.primary !== false;
    const disabled = opts?.disabled;
    switch (action.kind) {
      case 'open_attendance':
        return primary ? (
          <PrimaryButton label={label} onClick={onOpenAttendance} disabled={disabled} />
        ) : (
          <GlassButton label={label} onClick={onOpenAttendance} disabled={disabled} />
        );
      case 'open_squad':
        return primary ? (
          <PrimaryButton label={label} onClick={onOpenSquad} disabled={disabled} />
        ) : (
          <GlassButton label={label} onClick={onOpenSquad} disabled={disabled} />
        );
      case 'import_plan':
        return primary ? (
          <PrimaryButton label={label} onClick={onImportPlan} disabled={disabled} />
        ) : (
          <GlassButton label={label} onClick={onImportPlan} disabled={disabled} />
        );
      case 'add_match':
        return primary ? (
          <PrimaryButton label={label} onClick={onAddMatch} disabled={disabled} />
        ) : (
          <GlassButton label={label} onClick={onAddMatch} disabled={disabled} />
        );
      case 'prepare_match':
        return action.matchId ? (
          primary ? (
            <PrimaryButton label={label} to={matchPreparationPath(action.matchId, basePath)} />
          ) : (
            <Link
              to={matchPreparationPath(action.matchId, basePath)}
              className={`${dsSecondaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center rounded-full px-3 py-2 text-[15px] font-semibold`}
            >
              {label}
            </Link>
          )
        ) : null;
      case 'open_lineup':
        return action.matchId ? (
          <PrimaryButton label={label} to={matchLineupPath(action.matchId, basePath)} />
        ) : null;
      case 'start_live':
      case 'go_live':
        return action.matchId ? (
          <PrimaryButton label={label} to={liveMatchPath(action.matchId, basePath)} />
        ) : null;
      case 'create_report':
        return <PrimaryButton label={label} onClick={onCreateReport} disabled={disabled} />;
      case 'complete_tournament':
        return (
          <PrimaryButton
            label={completingTournament ? 'Wird abgeschlossen…' : label}
            onClick={onCompleteTournament}
            disabled={disabled || completingTournament}
          />
        );
      case 'refresh_plan':
        return (
          <PrimaryButton
            label={refreshingPlan ? 'Nächste Runde wird aktualisiert …' : label}
            onClick={() => onRefreshPlan?.()}
            disabled={disabled || refreshingPlan || !onRefreshPlan}
          />
        );
      case 'view_status':
        return <PrimaryButton label={label} onClick={onViewStatus} disabled={disabled} />;
      default:
        return null;
    }
  };

  const renderAction = (action: TournamentAssistantAction) => {
    if (action.kind === 'lineup_copy') {
      const targetMatchId = action.matchId ?? copyContext?.targetSlot.match_id?.trim() ?? '';
      return (
        <div className="flex flex-col gap-1.5">
          <p className="rounded-lg border sz-club-accent-chip px-2.5 py-2 text-[15px] font-semibold leading-snug sz-club-accent-text">
            Letzte Aufstellung übernehmen
          </p>
          {copyContext?.sourceOpponentName ? (
            <p className="text-[15px] leading-snug text-white/60">
              Spiel gegen {copyContext.sourceOpponentName}
              {copyContext.sourceStarterCount > 0
                ? ` · ${copyContext.sourceStarterCount} Startelf`
                : ''}
            </p>
          ) : null}
          {showReplaceConfirm ? (
            <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-2.5 py-2 text-[15px] leading-snug text-amber-100/90">
              Die bestehende Aufstellung dieses Spiels wird ersetzt. Bitte erneut tippen zum Bestätigen.
            </p>
          ) : copyContext?.targetHasExistingLineup ? (
            <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-2.5 py-2 text-[15px] leading-snug text-amber-100/90">
              Für dieses Spiel gibt es bereits eine Aufstellung. Übernehmen ersetzt sie.
            </p>
          ) : (
            <p className="text-[15px] leading-snug text-white/55">
              Formation, Startelf und Bank werden übernommen — ohne erneute Spielerauswahl.
            </p>
          )}
          <PrimaryButton
            label={copyBusy ? 'Wird übernommen…' : 'Komplette Aufstellung übernehmen'}
            onClick={() => void runCopy('full', showReplaceConfirm)}
            disabled={copyBusy || (copyContext?.sourceStarterCount ?? 0) < 1}
          />
          <GlassButton
            label="Nur Startelf übernehmen"
            onClick={() => void runCopy('starters', showReplaceConfirm)}
            disabled={copyBusy}
          />
          <GlassButton
            label="Nur Ersatzspieler übernehmen"
            onClick={() => void runCopy('bench', showReplaceConfirm)}
            disabled={copyBusy}
          />
          <GlassButton
            label="Mit Turnierkader neu aufstellen"
            onClick={() => void runCopy('squad_only', showReplaceConfirm)}
            disabled={copyBusy || !tournamentEventId}
          />
          {targetMatchId ? (
            <Link
              to={matchPreparationPath(targetMatchId, basePath)}
              className={`${dsSecondaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center rounded-full px-3 py-2 text-[15px] font-semibold`}
            >
              Manuell vorbereiten
            </Link>
          ) : null}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        {renderSingleAction(action, step.primaryLabel)}
        {step.secondaryAction && step.secondaryLabel
          ? renderSingleAction(step.secondaryAction, step.secondaryLabel, { primary: false })
          : null}
      </div>
    );
  };

  const preparationChecks = [
    { label: 'Verfügbarkeit klären', done: attendance.playerCount > 0 && attendance.openCount === 0, hint: `${attendance.yesCount} zugesagt · ${attendance.openCount} offen · ${attendance.noCount} abgesagt`, onClick: onOpenAttendance },
    { label: 'Turnierkader wählen', done: squadCount > 0, hint: squadCount > 0 ? `${squadCount} Spieler gespeichert` : 'Spieler für das Turnier auswählen', onClick: onOpenSquad },
    { label: 'Turnierplan hinterlegen', done: ownMatchCount > 0, hint: ownMatchCount > 0 ? `${ownMatchCount} eigene Spiele hinterlegt` : 'Plan importieren oder Spiele manuell anlegen', onClick: onImportPlan },
    { label: 'Aufstellung & Blöcke', done: templateReady || lineupReady, hint: templateReady || lineupReady ? 'Aufstellung gespeichert' : 'Grundaufstellung mit Block A und B vorbereiten', onClick: onOpenLineup },
  ];
  const prepared = preparationChecks.every(check => check.done);
  const gamePhaseStarted = slots.some(slot => ['live', 'finished'].includes(slot.match_status ?? ''));

  if (loading || lineupLoading || squadLoading) {
    return (
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className="text-[16px] font-bold uppercase tracking-[0.14em] sz-club-accent-text">Turnier-Assistent</p>
          <p className="mt-2 flex items-center gap-2 text-[16px] text-white/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Lade nächsten Schritt…
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={TC_CARD}>
      <div className={`${TC_CARD_INNER} flex flex-col gap-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[16px] font-bold uppercase tracking-[0.14em] sz-club-accent-text">
              <ClipboardList className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Turnier-Assistent
            </p>
            <StepProgress checks={preparationChecks.map(check => check.done)} />
          </div>
        </div>

        <p className="text-[16px] leading-relaxed text-white/65">Punkt antippen, bearbeiten und speichern. Erledigte Punkte werden grün.</p>
        <ol className="space-y-2" aria-label="Turnier vorbereiten">
          {preparationChecks.map((check, index) => <li key={check.label}>
            <button type="button" onClick={check.onClick}
              className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${check.done ? 'border-emerald-400/25 bg-emerald-400/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}
              aria-label={`${index + 1}. ${check.label} · ${check.done ? 'erledigt' : 'offen'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[17px] font-bold ${check.done ? 'bg-emerald-400/15 text-emerald-300' : 'sz-club-accent-chip sz-club-accent-text'}`}>
                {check.done ? <Check className="h-5 w-5" aria-hidden /> : index + 1}
              </span>
              <span className="min-w-0 flex-1"><span className="block text-[18px] font-bold leading-snug text-white">{check.label}</span><span className="mt-1 block text-[15px] leading-snug text-white/60">{check.hint}</span></span>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/50" aria-hidden />
            </button>
          </li>)}
        </ol>
        {prepared ? <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-[18px] font-bold text-emerald-300">✓ Turnier vorbereitet</p> : null}
        {prepared || gamePhaseStarted ? <div className="space-y-2 border-t border-white/10 pt-4">
          <p className="text-[15px] font-bold uppercase tracking-wide sz-club-accent-text">Am Turniertag</p>
          <h2 className="text-[21px] font-bold leading-snug text-white">{step.title}</h2>
          <p className="text-[16px] leading-relaxed text-white/65">{step.description}</p>
          {step.detailLines.map(line => <p key={line} className="text-[15px] text-white/65">{line}</p>)}
          {renderAction(step.action)}
        </div> : null}

        {copyError ? (
          <p className="text-[15px] text-red-300/90" role="alert">
            {copyError}
          </p>
        ) : null}


        {step.action.kind === 'complete_tournament' && canCreateReport ? (
          <SecondaryButton label="Zuerst Turnierbericht erstellen" onClick={onCreateReport} disabled={completingTournament} />
        ) : null}
      </div>
    </section>
  );
}
