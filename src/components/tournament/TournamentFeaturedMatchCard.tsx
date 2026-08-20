import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, Flag, Radio, Trophy } from 'lucide-react';
import {
  formatTournamentKickoffTime,
  tournamentMatchDisplayStatus,
  type TournamentMatchSlotView,
} from '../../lib/tournamentPlan';
import { fetchLineupForLiveMatch } from '../../lib/liveMatchService';
import { TournamentClubLogo } from './TournamentClubLogo';
import {
  formatTournamentLiveClock,
  type TournamentLiveMatchDetails,
} from '../../lib/matchCenterTournamentLive';
import {
  liveMatchPath,
  matchLineupPath,
  matchPreparationPath,
} from '../../lib/matchPreparationAccess';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { isStartelfCompleteFromStartingIds } from '../../pages/MatchDetail/lineupGuards';
import { safeOptionalText, safeText } from '../../lib/safeText';
import { supabase } from '../../lib/supabaseClient';
import {
  pickOrchestratorFocus,
  resolveTournamentOrchestrator,
  type TournamentOrchestratorCta,
} from '../../lib/tournamentDayOrchestrator';
import { CenterEmptyState } from '../center/CenterEmptyState';
import { useInternalBasePath } from '../../demo/demoPaths';
import { isDemoTournamentMatchId } from '../../demo/demoTournamentState';
import { TournamentOwnMatchEditSheet } from './TournamentOwnMatchEditSheet';

type Props = {
  slots: TournamentMatchSlotView[];
  ourTeamName: string;
  loading?: boolean;
  canManage?: boolean;
  tournamentArchived?: boolean;
  canCreateReport?: boolean;
  canCompleteTournament?: boolean;
  completingTournament?: boolean;
  awaitingFurtherPhase?: boolean;
  refreshingPlan?: boolean;
  tournamentDayIso?: string;
  onOpen: (matchId: string) => void;
  onAddMatch?: () => void;
  onCreateReport?: () => void;
  onCompleteTournament?: () => void;
  onShowOverview?: () => void;
  onRefreshPlan?: () => void;
  onSlotEdited?: () => void;
};

function TeamLogoMark({ name }: { name: string }) {
  return <TournamentClubLogo name={name} size="lg" tone="dark" />;
}

function WorkflowCtaLink({
  to,
  children,
  variant = 'primary',
}: {
  to: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const ctaClass = variant === 'primary' ? dsPrimaryCtaClass() : dsSecondaryCtaClass();
  return (
    <Link
      to={to}
      className={`${ctaClass} inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold`}
    >
      {children}
    </Link>
  );
}

function WorkflowCtaButton({
  children,
  variant = 'primary',
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick: () => void;
  disabled?: boolean;
}) {
  const ctaClass = variant === 'primary' ? dsPrimaryCtaClass() : dsSecondaryCtaClass();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${ctaClass} inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

function badgeClass(tone: 'live' | 'ready' | 'open' | 'finished' | 'neutral'): string {
  if (tone === 'live') return 'border-red-500/40 bg-red-950/45 text-red-200';
  if (tone === 'ready') return 'border-emerald-500/30 bg-emerald-950/35 text-emerald-200';
  if (tone === 'finished') return 'border-white/15 bg-white/[0.06] text-white/55';
  if (tone === 'open') return 'border-amber-500/28 bg-amber-950/30 text-amber-200';
  return 'border-white/12 bg-white/[0.05] text-white/50';
}

function renderCta(
  cta: TournamentOrchestratorCta,
  handlers: {
    onAddMatch?: () => void;
    onCreateReport?: () => void;
    onCompleteTournament?: () => void;
    onShowOverview?: () => void;
    onRefreshPlan?: () => void;
    completingTournament?: boolean;
    refreshingPlan?: boolean;
    basePath?: '/app' | '/demo';
  },
): React.ReactNode {
  const base = handlers.basePath ?? '/app';
  switch (cta.kind) {
    case 'add_match':
      return (
        <WorkflowCtaButton key={cta.kind} variant={cta.variant} onClick={() => handlers.onAddMatch?.()}>
          {cta.label}
        </WorkflowCtaButton>
      );
    case 'prepare':
      return (
        <WorkflowCtaLink
          key={`${cta.kind}-${cta.matchId}`}
          to={matchPreparationPath(cta.matchId, base)}
          variant={cta.variant}
        >
          {cta.label}
        </WorkflowCtaLink>
      );
    case 'open_lineup':
      return (
        <WorkflowCtaLink
          key={`${cta.kind}-${cta.matchId}`}
          to={matchLineupPath(cta.matchId, base)}
          variant={cta.variant}
        >
          {cta.label}
        </WorkflowCtaLink>
      );
    case 'start_live':
    case 'go_live':
      return (
        <WorkflowCtaLink
          key={`${cta.kind}-${cta.matchId}`}
          to={liveMatchPath(cta.matchId, base)}
          variant={cta.variant}
        >
          <Radio
            className={`h-3.5 w-3.5${cta.kind === 'go_live' ? ' animate-pulse' : ''}`}
            strokeWidth={2.25}
            aria-hidden
          />
          {cta.label}
        </WorkflowCtaLink>
      );
    case 'refresh_plan':
      return (
        <WorkflowCtaButton
          key={cta.kind}
          variant={cta.variant}
          disabled={handlers.refreshingPlan}
          onClick={() => handlers.onRefreshPlan?.()}
        >
          {handlers.refreshingPlan ? 'Nächste Runde wird aktualisiert …' : cta.label}
        </WorkflowCtaButton>
      );
    case 'create_report':
      return (
        <WorkflowCtaButton key={cta.kind} variant={cta.variant} onClick={() => handlers.onCreateReport?.()}>
          {cta.label}
        </WorkflowCtaButton>
      );
    case 'complete_tournament':
      return (
        <WorkflowCtaButton
          key={cta.kind}
          variant={cta.variant}
          disabled={handlers.completingTournament}
          onClick={() => handlers.onCompleteTournament?.()}
        >
          {handlers.completingTournament ? 'Wird abgeschlossen…' : cta.label}
        </WorkflowCtaButton>
      );
    case 'show_overview':
      return (
        <WorkflowCtaButton key={cta.kind} variant={cta.variant} onClick={() => handlers.onShowOverview?.()}>
          {cta.label}
        </WorkflowCtaButton>
      );
    default:
      return null;
  }
}

async function fetchLiveDetailsForMatch(matchId: string): Promise<TournamentLiveMatchDetails | null> {
  if (isDemoTournamentMatchId(matchId)) {
    const { getDemoLiveMatchRow } = await import('../../demo/demoLiveRuntime');
    const row = getDemoLiveMatchRow(matchId);
    if (!row || (row.status ?? '').toLowerCase() !== 'live') return null;
    return {
      scoreHome: Number(row.score_home ?? 0),
      scoreAway: Number(row.score_away ?? 0),
      liveElapsedSeconds: Number(row.live_elapsed_seconds ?? 0) || 0,
      liveIsRunning: Boolean(row.live_is_running),
      livePeriod: Number(row.live_period ?? 1) || 1,
    };
  }

  const { data, error } = await supabase
    .from('matches')
    .select('status, score_home, score_away, live_elapsed_seconds, live_is_running, live_period')
    .eq('id', matchId)
    .maybeSingle();

  if (error || !data || (data.status ?? '').toLowerCase() !== 'live') return null;

  return {
    scoreHome: Number(data.score_home ?? 0),
    scoreAway: Number(data.score_away ?? 0),
    liveElapsedSeconds: Number(data.live_elapsed_seconds ?? 0) || 0,
    liveIsRunning: Boolean(data.live_is_running),
    livePeriod: Number(data.live_period ?? 1) || 1,
  };
}

export function TournamentFeaturedMatchCard({
  slots,
  ourTeamName,
  loading = false,
  canManage = false,
  tournamentArchived = false,
  canCreateReport = false,
  canCompleteTournament = false,
  completingTournament = false,
  awaitingFurtherPhase = false,
  refreshingPlan = false,
  tournamentDayIso = '',
  onOpen,
  onAddMatch,
  onCreateReport,
  onCompleteTournament,
  onShowOverview,
  onRefreshPlan,
  onSlotEdited,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const basePath = useInternalBasePath();
  const focus = useMemo(() => pickOrchestratorFocus(slots), [slots]);
  const focusSlot = focus.kind !== 'none' ? focus.slot : null;
  const focusMatchId = focusSlot?.match_id?.trim() ?? '';

  const [lineupReady, setLineupReady] = useState(false);
  const [lineupLoading, setLineupLoading] = useState(false);
  const [liveDetails, setLiveDetails] = useState<TournamentLiveMatchDetails | null>(null);

  const orchestrator = useMemo(
    () =>
      resolveTournamentOrchestrator({
        slots,
        canManage,
        lineupReady,
        tournamentArchived,
        canCreateReport,
        canCompleteTournament,
        awaitingFurtherPhase,
      }),
    [
      slots,
      canManage,
      lineupReady,
      tournamentArchived,
      canCreateReport,
      canCompleteTournament,
      awaitingFurtherPhase,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    if (!focusMatchId || orchestrator.phase !== 'live') {
      setLiveDetails(null);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      const details = await fetchLiveDetailsForMatch(focusMatchId);
      if (!cancelled) setLiveDetails(details);
    };

    void load();
    const interval = window.setInterval(() => void load(), 8_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [focusMatchId, orchestrator.phase]);

  useEffect(() => {
    let cancelled = false;
    if (!canManage || !focusMatchId || orchestrator.phase === 'live' || orchestrator.phase === 'all_finished' || orchestrator.phase === 'awaiting_next_round' || orchestrator.phase === 'awaiting_knockout') {
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
  }, [canManage, focusMatchId, orchestrator.phase]);

  if (loading) {
    return (
      <article className="overflow-hidden rounded-[18px] border border-[rgba(255,71,71,0.18)] bg-[rgba(8,6,10,0.92)] px-3 py-3 sm:px-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-300/80">Nächstes Turnierspiel</p>
        <p className="mt-2 text-[13px] text-white/55">Lade Spiele…</p>
      </article>
    );
  }

  if (orchestrator.phase === 'no_matches') {
    return (
      <CenterEmptyState
        icon={Trophy}
        title="Kein Turnierspiel geplant"
        description="Füge ein Turnierspiel hinzu oder verknüpfe den offiziellen Turnierplan."
        actionLabel={canManage && onAddMatch ? 'Turnierspiel hinzufügen' : undefined}
        onAction={canManage && onAddMatch ? onAddMatch : undefined}
        actionVariant="primary"
      />
    );
  }

  if (!focusSlot) return null;

  const status = tournamentMatchDisplayStatus(focusSlot);
  const isLive = orchestrator.phase === 'live';
  const isAllFinished =
    orchestrator.phase === 'all_finished' ||
    orchestrator.phase === 'awaiting_next_round' ||
    orchestrator.phase === 'awaiting_knockout';
  const timeLabel = formatTournamentKickoffTime(focusSlot.kickoff_at);
  const group = safeOptionalText(focusSlot.group_label);
  const phase = safeOptionalText(focusSlot.phase);
  const pitch = safeOptionalText(focusSlot.pitch);
  const opponent = safeText(focusSlot.opponent_name) || 'Gegner';
  const ourTeam = safeText(ourTeamName) || 'Unser Team';
  const phaseLabel = phase ? phase : group ? `Gruppe ${group}` : null;

  const scoreHome = isLive && liveDetails ? liveDetails.scoreHome : focusSlot.score_home;
  const scoreAway = isLive && liveDetails ? liveDetails.scoreAway : focusSlot.score_away;
  const scoreLine =
    isLive || status.kind === 'result' || isAllFinished ? `${scoreHome} : ${scoreAway}` : null;
  const liveMinuteLabel =
    isLive && liveDetails
      ? formatTournamentLiveClock(liveDetails.liveElapsedSeconds, focusSlot.planned_minutes)
      : null;

  const headerIcon =
    orchestrator.phase === 'all_finished' ||
    orchestrator.phase === 'awaiting_next_round' ||
    orchestrator.phase === 'awaiting_knockout' ? (
      <Flag className="h-3 w-3 text-white/55" strokeWidth={2.25} aria-hidden />
    ) : null;

  return (
    <article
      className={`relative overflow-hidden rounded-[18px] border shadow-[0_12px_40px_rgba(0,0,0,0.5)] ${
        isLive
          ? 'border-[rgba(255,71,71,0.38)] shadow-[0_0_28px_rgba(255,71,71,0.14),0_12px_40px_rgba(0,0,0,0.5)]'
          : 'border-[rgba(255,71,71,0.22)]'
      }`}
    >
      <div className="border-b border-white/[0.06] bg-[rgba(10,8,12,0.96)] px-3 py-2 sm:px-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-300/85">
            {headerIcon}
            {orchestrator.headerTitle}
          </p>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${badgeClass(orchestrator.badgeTone)}`}
          >
            {isLive ? <Radio className="h-2.5 w-2.5 animate-pulse" strokeWidth={2.5} aria-hidden /> : null}
            {orchestrator.showLineupReadyMark ? (
              <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
            ) : null}
            {orchestrator.badgeLabel}
          </span>
        </div>
      </div>

      <div className="relative bg-[rgba(6,4,8,0.98)] px-3 py-3 sm:px-3.5 sm:py-3.5">
        <button
          type="button"
          onClick={() => {
            if (focusMatchId) onOpen(focusMatchId);
          }}
          className="flex w-full flex-col gap-2.5 text-left touch-manipulation"
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <TeamLogoMark name={ourTeam} />
              <p className="line-clamp-2 w-full text-center text-[10px] font-bold leading-snug text-white sm:text-[11px]">
                {ourTeam}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-0.5 px-0.5">
              {scoreLine ? (
                <>
                  <p className="text-[18px] font-bold tabular-nums leading-none text-white">{scoreLine}</p>
                  {liveMinuteLabel ? (
                    <p className="text-[10px] font-semibold tabular-nums text-red-300/90">{liveMinuteLabel}</p>
                  ) : null}
                </>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">vs</span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <TeamLogoMark name={opponent} />
              <p className="line-clamp-2 w-full text-center text-[10px] font-bold leading-snug text-white sm:text-[11px]">
                {opponent}
              </p>
            </div>
          </div>

          {!isAllFinished ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/68">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0 text-red-400/75" strokeWidth={2} aria-hidden />
                {timeLabel} Uhr
              </span>
              {phaseLabel ? <span className="text-white/45">· {phaseLabel}</span> : null}
              {pitch ? <span className="text-white/45">· {pitch}</span> : null}
            </div>
          ) : (
            <p className="text-[11px] leading-snug text-white/55">
              {orchestrator.footerHint ??
                'Turnier kann abgeschlossen werden — Bericht erstellen oder Turnier abschließen.'}
            </p>
          )}
        </button>

        {orchestrator.ctas.length > 0 ? (
          <div className="mt-2.5 flex flex-col gap-1.5 border-t border-white/[0.06] pt-2.5">
            {orchestrator.ctas.map((cta) =>
              renderCta(cta, {
                onAddMatch,
                onCreateReport,
                onCompleteTournament,
                onShowOverview,
                onRefreshPlan,
                completingTournament,
                refreshingPlan,
                basePath,
              }),
            )}
            {canManage &&
            focusSlot &&
            !isLive &&
            !isAllFinished &&
            (focusSlot.match_status ?? 'upcoming').toLowerCase() !== 'finished' ? (
              <WorkflowCtaButton variant="secondary" onClick={() => setEditOpen(true)}>
                Spiel bearbeiten
              </WorkflowCtaButton>
            ) : null}
            {lineupLoading ? (
              <p className="text-center text-[10px] text-white/40">Prüfe Aufstellung…</p>
            ) : null}
          </div>
        ) : !canManage && isLive ? (
          <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
            <WorkflowCtaLink to={liveMatchPath(focusMatchId, basePath)} variant="primary">
              <Radio className="h-3.5 w-3.5 animate-pulse" strokeWidth={2.25} aria-hidden />
              Zum Live-Spiel
            </WorkflowCtaLink>
          </div>
        ) : null}
      </div>
      {canManage && focusSlot && tournamentDayIso ? (
        <TournamentOwnMatchEditSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          slot={focusSlot}
          tournamentDayIso={tournamentDayIso}
          ourTeamName={ourTeamName}
          onSaved={() => onSlotEdited?.()}
        />
      ) : null}
    </article>
  );
}
