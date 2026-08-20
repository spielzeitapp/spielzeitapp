import React from 'react';
import { Link } from 'react-router-dom';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { matchLineupPath, matchPreparationPath } from '../../lib/matchPreparationAccess';
import {
  tournamentCenterPath,
  type TournamentMatchNavigationContext,
} from '../../lib/tournamentMatchNavigation';
import { formatTournamentKickoffTime } from '../../lib/tournamentPlan';
import { tournamentPrepareCtaLabel } from '../../lib/tournamentDayOrchestrator';
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  context: TournamentMatchNavigationContext;
  className?: string;
  /** Trainer: Vorbereitung; Eltern/Fans: Details / Live. */
  audience?: 'trainer' | 'audience';
  /** Während aktuelles Spiel noch läuft vs. nach Ende. */
  phase?: 'during_live' | 'after_finish' | 'before_first';
  /** Optional: manueller Sync-Status / Refresh aus Live-Screen. */
  planSyncBusy?: boolean;
  planSyncStatus?: string | null;
  onRefreshPlan?: () => void;
};

/** Eine dominante Next-Match-Karte für Live-/Match-Surfaces (Trainer + Eltern/Fans). */
export function TournamentNextMatchWorkflowCta({
  context,
  className = '',
  audience = 'trainer',
  phase = 'after_finish',
  planSyncBusy = false,
  planSyncStatus = null,
  onRefreshPlan,
}: Props) {
  const basePath = useInternalBasePath();
  const { nextSlot, tournamentEventId, tournamentTitle, awaitingFurtherPhase } = context;
  const isTrainer = audience === 'trainer';

  if (nextSlot) {
    const kickoff = formatTournamentKickoffTime(nextSlot.kickoff_at);
    const pitch = String(nextSlot.pitch ?? '').trim();
    const meta = [kickoff ? `${kickoff} Uhr` : null, pitch || null].filter(Boolean).join(' · ');
    const nextLive = (nextSlot.match_status ?? '').toLowerCase() === 'live';
    const phaseHint = String(nextSlot.phase ?? '').trim();
    const heading =
      phase === 'during_live' ? 'Danach' : phase === 'before_first' ? 'Nächstes Spiel' : 'Nächstes Spiel';
    const prepareLabel = tournamentPrepareCtaLabel(nextSlot, 1);
    const sub =
      phase === 'after_finish'
        ? isTrainer
          ? nextSlot.has_lineup
            ? 'Aufstellung kann übernommen werden'
            : prepareLabel
          : `Weiter geht's um ${kickoff || '—'} Uhr`
        : null;

    let ctaTo = tournamentCenterPath(tournamentEventId, basePath);
    let ctaLabel = 'Spieldetails';
    if (nextLive && nextSlot.match_id) {
      ctaTo = `${basePath}/live?matchId=${encodeURIComponent(nextSlot.match_id)}`;
      ctaLabel = 'Zum Live-Spiel';
    } else if (isTrainer && nextSlot.match_id) {
      ctaTo = nextSlot.has_lineup
        ? matchLineupPath(nextSlot.match_id, basePath)
        : matchPreparationPath(nextSlot.match_id, basePath);
      ctaLabel = phase === 'after_finish' ? prepareLabel : 'Spiel vorbereiten';
    } else if (!isTrainer && nextSlot.match_id) {
      ctaTo = matchLineupPath(nextSlot.match_id, basePath);
      ctaLabel = 'Nächstes Spiel ansehen';
    }

    return (
      <div
        className={`rounded-2xl border border-white/10 bg-[rgba(18,18,22,0.92)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-200/85">
          {heading}
        </p>
        {phaseHint ? (
          <p className="mt-0.5 text-[11px] font-medium text-white/55">{phaseHint}</p>
        ) : null}
        <p className="mt-1 text-[14px] font-bold leading-snug text-white">
          {nextSlot.opponent_name || 'Gegner'}
        </p>
        {meta ? <p className="mt-0.5 text-[12px] text-white/60">{meta}</p> : null}
        {sub ? <p className="mt-1 text-[11px] text-white/50">{sub}</p> : null}
        <p className="mt-1 text-[10px] text-white/40">{tournamentTitle}</p>
        {planSyncBusy || planSyncStatus ? (
          <p className="mt-1.5 text-[11px] text-white/50" role="status" aria-live="polite">
            {planSyncBusy ? planSyncStatus ?? 'Turnierplan wird aktualisiert …' : planSyncStatus}
          </p>
        ) : null}
        <Link
          to={ctaTo}
          className={`${dsPrimaryCtaClass()} mt-2.5 flex min-h-[44px] w-full touch-manipulation items-center justify-center px-4 py-2.5 text-[13px] font-bold`}
        >
          {ctaLabel}
        </Link>
      </div>
    );
  }

  if (phase === 'during_live') return null;

  if (awaitingFurtherPhase) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-[rgba(18,18,22,0.92)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/85">
          Vorrunde beendet
        </p>
        <p className="mt-1 text-[14px] font-bold leading-snug text-white">Warte auf nächste Runde</p>
        <p className="mt-1 text-[12px] leading-snug text-white/55">
          Der Turnierplan wird automatisch aktualisiert. Sobald Halbfinale, Finale oder
          Platzierungsspiel feststeht, erscheint das nächste Spiel automatisch.
        </p>
        {planSyncBusy || planSyncStatus ? (
          <p className="mt-1.5 text-[11px] text-white/50" role="status" aria-live="polite">
            {planSyncBusy ? planSyncStatus ?? 'Nächste Runde wird aktualisiert …' : planSyncStatus}
          </p>
        ) : null}
        <Link
          to={tournamentCenterPath(tournamentEventId, basePath)}
          className={`${dsPrimaryCtaClass()} mt-2.5 flex min-h-[44px] w-full touch-manipulation items-center justify-center px-4 py-2.5 text-[13px] font-bold`}
        >
          Turnier öffnen
        </Link>
        {isTrainer && onRefreshPlan ? (
          <button
            type="button"
            disabled={planSyncBusy}
            onClick={onRefreshPlan}
            className={`${dsSecondaryCtaClass()} mt-2 flex min-h-[44px] w-full touch-manipulation items-center justify-center px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60`}
          >
            {planSyncBusy ? 'Wird aktualisiert …' : 'Jetzt aktualisieren'}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p className="text-center text-[12px] leading-snug text-white/55">
        {isTrainer ? 'Kein weiteres Turnierspiel geplant.' : 'Kein weiteres Spiel geplant.'}
      </p>
      {planSyncBusy || planSyncStatus ? (
        <p className="text-center text-[11px] text-white/50" role="status" aria-live="polite">
          {planSyncBusy ? planSyncStatus ?? 'Turnierplan wird aktualisiert …' : planSyncStatus}
        </p>
      ) : null}
      <Link
        to={tournamentCenterPath(tournamentEventId, basePath)}
        className={`${dsSecondaryCtaClass()} flex min-h-[44px] w-full touch-manipulation items-center justify-center px-4 py-2.5 text-[13px] font-semibold`}
      >
        Zurück zum Turniercenter
      </Link>
    </div>
  );
}

type PrepareButtonProps = {
  matchId: string;
  className?: string;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
};

export function TournamentPrepareButton({
  matchId,
  className = '',
  variant = 'secondary',
  fullWidth = true,
}: PrepareButtonProps) {
  const basePath = useInternalBasePath();
  const ctaClass = variant === 'primary' ? dsPrimaryCtaClass() : dsSecondaryCtaClass();
  return (
    <Link
      to={matchPreparationPath(matchId, basePath)}
      className={`${ctaClass} inline-flex min-h-[40px] touch-manipulation items-center justify-center px-4 py-2 text-[13px] font-semibold ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      Vorbereiten
    </Link>
  );
}
