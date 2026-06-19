import React from 'react';
import { ChevronRight, Radio } from 'lucide-react';
import {
  formatTournamentKickoffTime,
  tournamentMatchDisplayStatus,
  type TournamentMatchSlotView,
} from '../../lib/tournamentPlan';
import { dsStatusChipClass } from '../../lib/premiumDesignSystem';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';
import { pickFeaturedTournamentSlot } from './tournamentCenterUtils';

type Props = {
  slots: TournamentMatchSlotView[];
  loading?: boolean;
  onOpen: (matchId: string) => void;
};

export function TournamentFeaturedMatchCard({ slots, loading = false, onOpen }: Props) {
  const featured = pickFeaturedTournamentSlot(slots);

  if (loading) {
    return (
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className={TC_SECTION_LABEL}>Nächstes Spiel</p>
          <p className="mt-2 text-[14px] text-white/55">Lade Spiele…</p>
        </div>
      </section>
    );
  }

  if (!featured) {
    return (
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className={TC_SECTION_LABEL}>Spielplan</p>
          <p className="mt-2 text-[14px] text-white/55">Keine Turnierspiele geplant.</p>
        </div>
      </section>
    );
  }

  const status = tournamentMatchDisplayStatus(featured);
  const isLive = status.kind === 'live';
  const timeLabel = formatTournamentKickoffTime(featured.kickoff_at);
  const group = featured.group_label?.trim();
  const pitch = featured.pitch?.trim();
  const scoreLine =
    status.kind === 'result' ? `${status.ourGoals}:${status.oppGoals}` : null;

  return (
    <section className={`${TC_CARD} ${isLive ? 'border-[rgba(255,71,71,0.32)] shadow-[0_0_28px_rgba(255,71,71,0.12)]' : ''}`}>
      <button
        type="button"
        onClick={() => onOpen(featured.match_id)}
        className={`${TC_CARD_INNER} flex w-full flex-col gap-2 text-left touch-manipulation`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className={TC_SECTION_LABEL}>{isLive ? 'Live-Spiel' : 'Nächstes Spiel'}</p>
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-200">
              <Radio className="h-3 w-3 animate-pulse" strokeWidth={2.5} aria-hidden />
              Live
            </span>
          ) : (
            <span className={dsStatusChipClass('open')}>Geplant</span>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {scoreLine ? (
              <p className="text-[22px] font-bold tabular-nums leading-none text-white">
                {scoreLine}
                <span className="ml-2 text-[15px] font-semibold text-white/70">vs</span>
              </p>
            ) : null}
            <p className={`font-bold leading-snug text-white break-words ${scoreLine ? 'mt-1 text-[16px]' : 'text-[18px]'}`}>
              {featured.opponent_name}
            </p>
            <p className="mt-1 text-[13px] tabular-nums text-white/65">
              {timeLabel} Uhr
              {group ? ` · Gruppe ${group}` : ''}
              {pitch ? ` · ${pitch}` : ''}
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-white/35" strokeWidth={2} aria-hidden />
        </div>
      </button>
    </section>
  );
}
