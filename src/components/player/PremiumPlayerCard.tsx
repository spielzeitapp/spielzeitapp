import React from 'react';
import { getPositionLabel } from '../../lib/positionLabels';
import {
  premiumPlayerAvatarRingClass,
  premiumPlayerAvatarSrc,
  premiumPlayerCardGlowClass,
  premiumPlayerCardShellClass,
  premiumPlayerDisplayName,
  premiumPlayerInitials,
  premiumPlayerNameClass,
  premiumPlayerSublineClass,
  type PremiumPlayerCardDensity,
  type PremiumPlayerCardPlayer,
  type PremiumPlayerCardTone,
} from '../../lib/premiumPlayerCard';

export type { PremiumPlayerCardPlayer, PremiumPlayerCardTone };

type Props = {
  player: PremiumPlayerCardPlayer;
  /** Position · #Nr — falls nicht gesetzt aus player.position + jersey_number */
  subline?: string | null;
  density?: PremiumPlayerCardDensity;
  /** utility = ruhig (Kader, Training); matchday = Live/Startaufstellung */
  tone?: PremiumPlayerCardTone;
  /** Startelf / aktiver Slot — Matchday-Hero ohne Utility-Selected-Ring */
  active?: boolean;
  selected?: boolean;
  onClick?: () => void;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

function buildSubline(player: PremiumPlayerCardPlayer, override?: string | null): string {
  if (override != null && String(override).trim()) return String(override).trim();
  const pos = getPositionLabel(player.position) || (player.position ?? '').trim() || '—';
  const num = player.jersey_number ?? player.number;
  const numPart = num != null ? `#${num}` : null;
  return [pos !== '—' ? pos : null, numPart].filter(Boolean).join(' · ') || '—';
}

export const PremiumPlayerCard: React.FC<Props> = ({
  player,
  subline,
  density = 'default',
  tone = 'utility',
  active = false,
  selected = false,
  onClick,
  trailing,
  footer,
  className = '',
}) => {
  const name = premiumPlayerDisplayName(player);
  const avatarSrc = premiumPlayerAvatarSrc(player);
  const initials = premiumPlayerInitials(name);
  const sub = buildSubline(player, subline);
  const isMatchday = tone === 'matchday';
  const avatarSize = density === 'compact' ? 'h-9 w-9' : 'h-10 w-10 sm:h-11 sm:w-11';

  const shellClass = premiumPlayerCardShellClass({
    tone,
    active,
    selected: tone === 'utility' ? selected : active || selected,
    interactive: Boolean(onClick),
    density,
    className,
  });

  const body = (
    <>
      <div className={premiumPlayerCardGlowClass(tone)} aria-hidden />
      <div className="relative flex items-center gap-2.5">
        <div className={`relative shrink-0 ${avatarSize}`}>
          {isMatchday ? (
            <div
              className="pointer-events-none absolute -inset-0.5 rounded-full bg-red-600/25 blur-[5px]"
              aria-hidden
            />
          ) : null}
          <img
            src={avatarSrc}
            alt=""
            className={`relative z-[1] ${avatarSize} ${premiumPlayerAvatarRingClass(tone)}`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const next = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (next) next.style.display = 'flex';
            }}
          />
          <div
            className={`relative z-[1] hidden ${avatarSize} items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 text-[10px] font-bold text-white/80`}
          >
            {initials}
          </div>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className={premiumPlayerNameClass(density, tone)}>{name}</p>
          <p className={premiumPlayerSublineClass(tone)}>{sub}</p>
        </div>
        {trailing ? <div className="flex shrink-0 flex-col items-end justify-center gap-1">{trailing}</div> : null}
      </div>
      {footer ? <div className="relative mt-2 border-t border-white/[0.05] pt-2">{footer}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shellClass}>
        {body}
      </button>
    );
  }
  return <div className={shellClass}>{body}</div>;
};
