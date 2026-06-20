import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Radio, Trophy } from 'lucide-react';
import {
  formatTournamentKickoffTime,
  isTournamentSlotPreparable,
  tournamentMatchDisplayStatus,
  type TournamentMatchSlotView,
} from '../../lib/tournamentPlan';
import { fetchLineupForLiveMatch } from '../../lib/liveMatchService';
import { getClubLogo, getTeamInitials } from '../../lib/teamLogos';
import {
  isMatchPreparationAccessible,
  liveMatchPath,
  matchLineupPath,
  matchPreparationPath,
} from '../../lib/matchPreparationAccess';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { isStartelfCompleteFromStartingIds } from '../../pages/MatchDetail/lineupGuards';
import { safeOptionalText, safeText } from '../../lib/safeText';
import { CenterEmptyState } from '../center/CenterEmptyState';
import { pickFeaturedTournamentSlot } from './tournamentCenterUtils';

type Props = {
  slots: TournamentMatchSlotView[];
  ourTeamName: string;
  loading?: boolean;
  canManage?: boolean;
  onOpen: (matchId: string) => void;
  onAddMatch?: () => void;
};

function TeamLogoMark({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const src = getClubLogo(name);
  if (failed) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-black/50 text-[11px] font-bold text-white/80 sm:h-12 sm:w-12">
        {getTeamInitials(name)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12"
      onError={() => setFailed(true)}
    />
  );
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

function resolveWorkflowState(
  featured: TournamentMatchSlotView,
  lineupReady: boolean,
): 'live' | 'lineup_ready' | 'planned' | 'finished' {
  const status = tournamentMatchDisplayStatus(featured);
  if (status.kind === 'live') return 'live';
  if (status.kind === 'result') return 'finished';
  if (lineupReady) return 'lineup_ready';
  return 'planned';
}

function workflowBadgeLabel(state: ReturnType<typeof resolveWorkflowState>): string {
  if (state === 'live') return 'Live';
  if (state === 'lineup_ready') return 'Aufstellung fertig';
  if (state === 'finished') return 'Beendet';
  return 'Geplant';
}

export function TournamentFeaturedMatchCard({
  slots,
  ourTeamName,
  loading = false,
  canManage = false,
  onOpen,
  onAddMatch,
}: Props) {
  const featured = pickFeaturedTournamentSlot(slots);
  const nextOpenSlot = useMemo(() => {
    if (!featured) return null;
    const open = slots
      .filter((s) => (s.match_status ?? '').toLowerCase() !== 'finished')
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
    return open.find((s) => s.id !== featured.id) ?? open[0] ?? null;
  }, [featured, slots]);

  const [lineupReady, setLineupReady] = useState(false);
  const [lineupLoading, setLineupLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const matchId = featured?.match_id?.trim() ?? '';
    if (!canManage || !matchId) {
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
  }, [canManage, featured?.match_id]);

  if (loading) {
    return (
      <article className="overflow-hidden rounded-[18px] border border-[rgba(255,71,71,0.18)] bg-[rgba(8,6,10,0.92)] px-3 py-3 sm:px-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-300/80">Nächstes Turnierspiel</p>
        <p className="mt-2 text-[13px] text-white/55">Lade Spiele…</p>
      </article>
    );
  }

  if (!featured) {
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

  const status = tournamentMatchDisplayStatus(featured);
  const workflowState = resolveWorkflowState(featured, lineupReady);
  const isLive = workflowState === 'live';
  const isFinished = workflowState === 'finished';
  const canPrepare =
    canManage &&
    !isLive &&
    !isFinished &&
    isTournamentSlotPreparable(featured) &&
    isMatchPreparationAccessible(featured.match_status);
  const timeLabel = formatTournamentKickoffTime(featured.kickoff_at);
  const group = safeOptionalText(featured.group_label);
  const phase = safeOptionalText(featured.phase);
  const pitch = safeOptionalText(featured.pitch);
  const scoreLine = status.kind === 'result' ? `${status.ourGoals}:${status.oppGoals}` : null;
  const matchId = featured.match_id;
  const opponent = safeText(featured.opponent_name) || 'Gegner';
  const ourTeam = safeText(ourTeamName) || 'Unser Team';
  const phaseLabel = phase ? phase : group ? `Gruppe ${group}` : null;

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
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-300/85">
            {isLive ? 'Live-Spiel' : 'Nächstes Turnierspiel'}
          </p>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
              isLive
                ? 'border-red-500/40 bg-red-950/45 text-red-200'
                : workflowState === 'lineup_ready'
                  ? 'border-emerald-500/30 bg-emerald-950/35 text-emerald-200'
                  : workflowState === 'finished'
                    ? 'border-white/15 bg-white/[0.06] text-white/55'
                    : 'border-amber-500/28 bg-amber-950/30 text-amber-200'
            }`}
          >
            {isLive ? <Radio className="h-2.5 w-2.5 animate-pulse" strokeWidth={2.5} aria-hidden /> : null}
            {workflowBadgeLabel(workflowState)}
          </span>
        </div>
      </div>

      <div className="relative bg-[rgba(6,4,8,0.98)] px-3 py-3 sm:px-3.5 sm:py-3.5">
        <button
          type="button"
          onClick={() => onOpen(matchId)}
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
                <p className="text-[18px] font-bold tabular-nums leading-none text-white">{scoreLine}</p>
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

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/68">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0 text-red-400/75" strokeWidth={2} aria-hidden />
              {timeLabel} Uhr
            </span>
            {phaseLabel ? <span className="text-white/45">· {phaseLabel}</span> : null}
            {pitch ? <span className="text-white/45">· {pitch}</span> : null}
          </div>
        </button>

        {canManage ? (
          <div className="mt-2.5 flex flex-col gap-1.5 border-t border-white/[0.06] pt-2.5">
            {isLive ? (
              <WorkflowCtaLink to={liveMatchPath(matchId)} variant="primary">
                <Radio className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                Zum Live-Spiel
              </WorkflowCtaLink>
            ) : isFinished ? (
              nextOpenSlot ? (
                <WorkflowCtaLink to={matchPreparationPath(nextOpenSlot.match_id)} variant="primary">
                  Nächstes Spiel vorbereiten
                </WorkflowCtaLink>
              ) : null
            ) : workflowState === 'lineup_ready' ? (
              <>
                <WorkflowCtaLink to={matchLineupPath(matchId)} variant="secondary">
                  Aufstellung öffnen
                </WorkflowCtaLink>
                <WorkflowCtaLink to={liveMatchPath(matchId)} variant="primary">
                  Live starten
                </WorkflowCtaLink>
              </>
            ) : canPrepare ? (
              <WorkflowCtaLink to={matchPreparationPath(matchId)} variant="primary">
                Spiel vorbereiten
              </WorkflowCtaLink>
            ) : featured.has_lineup ? (
              <WorkflowCtaLink to={matchLineupPath(matchId)} variant="primary">
                Aufstellung öffnen
              </WorkflowCtaLink>
            ) : null}
            {lineupLoading ? (
              <p className="text-center text-[10px] text-white/40">Prüfe Aufstellung…</p>
            ) : null}
          </div>
        ) : isLive ? (
          <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
            <WorkflowCtaLink to={liveMatchPath(matchId)} variant="primary">
              <Radio className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              Zum Live-Spiel
            </WorkflowCtaLink>
          </div>
        ) : null}
      </div>
    </article>
  );
}
