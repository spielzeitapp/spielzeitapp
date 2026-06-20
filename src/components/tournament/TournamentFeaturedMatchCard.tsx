import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, Plus, Radio } from 'lucide-react';
import {
  formatTournamentKickoffTime,
  isTournamentSlotPreparable,
  tournamentMatchDisplayStatus,
  type TournamentMatchSlotView,
} from '../../lib/tournamentPlan';
import { fetchLineupForLiveMatch } from '../../lib/liveMatchService';
import {
  isMatchPreparationAccessible,
  liveMatchPath,
  matchLineupPath,
  matchPreparationPath,
} from '../../lib/matchPreparationAccess';
import { dsPrimaryCtaClass, dsScheduleGlassButtonClass, dsSecondaryCtaClass, dsStatusChipClass } from '../../lib/premiumDesignSystem';
import { isStartelfCompleteFromStartingIds } from '../../pages/MatchDetail/lineupGuards';
import { safeOptionalText } from '../../lib/safeText';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';
import { pickFeaturedTournamentSlot } from './tournamentCenterUtils';

type Props = {
  slots: TournamentMatchSlotView[];
  loading?: boolean;
  canManage?: boolean;
  hasOfficialPlanUrl?: boolean;
  onOpen: (matchId: string) => void;
  onAddMatch?: () => void;
  onImportPlan?: () => void;
};

const compactCtaClass = (variant: 'primary' | 'secondary' | 'glass' = 'secondary') => {
  const base = 'inline-flex min-h-[36px] touch-manipulation items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold';
  if (variant === 'primary') return `${base} ${dsPrimaryCtaClass()}`;
  if (variant === 'glass') return `${base} ${dsScheduleGlassButtonClass()}`;
  return `${base} ${dsSecondaryCtaClass()}`;
};

function WorkflowCtaLink({
  to,
  children,
  variant = 'secondary',
  className = '',
}: {
  to: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'glass';
  className?: string;
}) {
  return (
    <Link to={to} className={`${compactCtaClass(variant)} w-full ${className}`}>
      {children}
    </Link>
  );
}

export function TournamentFeaturedMatchCard({
  slots,
  loading = false,
  canManage = false,
  hasOfficialPlanUrl = false,
  onOpen,
  onAddMatch,
  onImportPlan,
}: Props) {
  const featured = pickFeaturedTournamentSlot(slots);
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
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className={TC_SECTION_LABEL}>Nächstes Spiel</p>
          <p className="mt-1.5 text-[13px] text-white/55">Lade Spiele…</p>
        </div>
      </section>
    );
  }

  if (!featured) {
    return (
      <section className={TC_CARD}>
        <div className={`${TC_CARD_INNER} flex flex-col gap-2`}>
          <p className={TC_SECTION_LABEL}>Spielplan</p>
          <p className="text-[13px] leading-snug text-white/65">Noch keine Turnierspiele geplant.</p>
          {canManage ? (
            <div className="flex flex-col gap-1.5 sm:flex-row">
              {onAddMatch ? (
                <button type="button" className={`${compactCtaClass('primary')} w-full sm:flex-1`} onClick={onAddMatch}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  Turnierspiel hinzufügen
                </button>
              ) : null}
              {onImportPlan ? (
                <button type="button" className={`${compactCtaClass('glass')} w-full sm:flex-1`} onClick={onImportPlan}>
                  <FileDown className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  {hasOfficialPlanUrl ? 'Turnierplan importieren' : 'Turnierplan verknüpfen'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const status = tournamentMatchDisplayStatus(featured);
  const isLive = status.kind === 'live';
  const isPreparation = status.kind === 'preparation';
  const hasLineup = featured.has_lineup;
  const canPrepare =
    canManage && !isLive && isTournamentSlotPreparable(featured) && isMatchPreparationAccessible(featured.match_status);
  const timeLabel = formatTournamentKickoffTime(featured.kickoff_at);
  const group = safeOptionalText(featured.group_label);
  const pitch = safeOptionalText(featured.pitch);
  const scoreLine = status.kind === 'result' ? `${status.ourGoals}:${status.oppGoals}` : null;
  const matchId = featured.match_id;

  return (
    <section className={`${TC_CARD} ${isLive ? 'border-[rgba(255,71,71,0.32)] shadow-[0_0_24px_rgba(255,71,71,0.1)]' : ''}`}>
      <div className={`${TC_CARD_INNER} flex flex-col gap-2`}>
        <button
          type="button"
          onClick={() => onOpen(matchId)}
          className="flex w-full flex-col gap-1.5 text-left touch-manipulation"
        >
          <div className="flex items-center justify-between gap-2">
            <p className={TC_SECTION_LABEL}>{isLive ? 'Live-Spiel' : 'Nächstes Spiel'}</p>
            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-950/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-200">
                <Radio className="h-3 w-3 animate-pulse" strokeWidth={2.5} aria-hidden />
                Live
              </span>
            ) : isPreparation ? (
              <span className={dsStatusChipClass('open')}>Vorbereitung</span>
            ) : (
              <span className={dsStatusChipClass('neutral')}>Geplant</span>
            )}
          </div>

          <div className="min-w-0">
            {scoreLine ? (
              <p className="text-[20px] font-bold tabular-nums leading-none text-white">
                {scoreLine}
                <span className="ml-2 text-[14px] font-semibold text-white/65">vs</span>
              </p>
            ) : null}
            <p
              className={`font-bold leading-snug text-white break-words ${scoreLine ? 'mt-1 text-[15px]' : 'text-[17px]'}`}
            >
              {featured.opponent_name}
            </p>
            <p className="mt-0.5 text-[12px] tabular-nums text-white/60">
              {timeLabel} Uhr
              {group ? ` · Gruppe ${group}` : ''}
              {pitch ? ` · ${pitch}` : ''}
            </p>
          </div>
        </button>

        {canManage ? (
          <div className="flex flex-col gap-1.5 border-t border-white/[0.06] pt-2">
            {isLive ? (
              <WorkflowCtaLink to={liveMatchPath(matchId)} variant="primary">
                <Radio className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                Zum Live-Spiel
              </WorkflowCtaLink>
            ) : lineupReady ? (
              <>
                <WorkflowCtaLink to={liveMatchPath(matchId)} variant="primary">
                  Live starten
                </WorkflowCtaLink>
                <WorkflowCtaLink to={matchLineupPath(matchId)} variant="secondary">
                  Aufstellung öffnen
                </WorkflowCtaLink>
              </>
            ) : hasLineup || isPreparation ? (
              <>
                <WorkflowCtaLink to={matchLineupPath(matchId)} variant="primary">
                  Aufstellung öffnen
                </WorkflowCtaLink>
                {canPrepare ? (
                  <WorkflowCtaLink to={matchPreparationPath(matchId)} variant="secondary">
                    Spiel vorbereiten
                  </WorkflowCtaLink>
                ) : null}
              </>
            ) : canPrepare ? (
              <WorkflowCtaLink to={matchPreparationPath(matchId)} variant="primary">
                Spiel vorbereiten
              </WorkflowCtaLink>
            ) : null}
            {lineupLoading ? (
              <p className="text-center text-[10px] text-white/40">Prüfe Aufstellung…</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
