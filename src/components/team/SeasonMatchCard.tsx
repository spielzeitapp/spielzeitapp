import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import type { SeasonMatchCardData } from '../../lib/seasonMatchStats';
import { seasonMatchCardHref } from '../../lib/seasonMatchStats';
import { GlassCard } from '../../ui';

type Props = {
  match: SeasonMatchCardData;
  compact?: boolean;
};

function formatMatchDateDe(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatScore(match: SeasonMatchCardData): string {
  const st = (match.status ?? '').trim().toLowerCase();
  if (st === 'live') return 'Live';
  if (match.teamGoals != null && match.oppGoals != null) {
    return `${match.teamGoals} : ${match.oppGoals}`;
  }
  return '—';
}

function statusLabel(match: SeasonMatchCardData): string {
  if (match.displayStatus === 'live') return 'Live';
  if (match.displayStatus === 'win') return 'Sieg';
  if (match.displayStatus === 'draw') return 'Remis';
  if (match.displayStatus === 'loss') return 'Niederlage';
  return 'Geplant';
}

function statusClass(match: SeasonMatchCardData): string {
  if (match.displayStatus === 'live') return 'text-red-400';
  if (match.displayStatus === 'win') return 'text-emerald-400';
  if (match.displayStatus === 'draw') return 'text-amber-300';
  if (match.displayStatus === 'loss') return 'text-red-400';
  return 'text-white/60';
}

export const SeasonMatchCard: React.FC<Props> = ({ match, compact = false }) => {
  const navigate = useNavigate();
  const href = seasonMatchCardHref(match.eventId);
  const clickable = Boolean(href);

  const handleClick = () => {
    if (href) navigate(href);
  };

  const venue = (match.location ?? '').trim();
  const homeAway =
    match.isHome === true ? 'Heim' : match.isHome === false ? 'Auswärts' : null;

  return (
    <GlassCard
      variant={clickable ? 'interactive' : 'subtle'}
      showAmbientGlow={false}
      className={[
        'w-full px-3 py-3',
        clickable ? 'transition-[box-shadow,transform] active:scale-[0.99]' : '',
        compact ? 'py-2.5' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={clickable ? handleClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span
              className={[
                'line-clamp-2 min-w-0 font-semibold leading-snug text-white',
                compact ? 'text-[15px]' : 'text-[17px]',
              ].join(' ')}
            >
              {(match.opponent ?? '').trim() || '—'}
            </span>
            <span className="shrink-0 tabular-nums font-bold text-white">{formatScore(match)}</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
            <span className="text-white/60">{formatMatchDateDe(match.match_date)}</span>
            {homeAway ? <span className="text-white/45">· {homeAway}</span> : null}
            <span className={`font-semibold ${statusClass(match)}`}>{statusLabel(match)}</span>
          </div>

          {venue ? (
            <div className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-white/50">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              <span className="line-clamp-1">{venue}</span>
            </div>
          ) : null}
        </div>

        {clickable ? (
          <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5 text-white/45">
            <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            <span className="text-[10px] font-medium">Details</span>
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
};
