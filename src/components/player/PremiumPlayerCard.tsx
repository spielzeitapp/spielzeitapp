import React from 'react';
import { getPositionLabel } from '../../lib/positionLabels';
import {
  premiumPlayerAvatarSrc,
  premiumPlayerCardShellClass,
  premiumPlayerDisplayName,
  premiumPlayerInitials,
  premiumPlayerNameClass,
  premiumPlayerSublineClass,
  type PremiumPlayerCardDensity,
  type PremiumPlayerCardPlayer,
} from '../../lib/premiumPlayerCard';

export type { PremiumPlayerCardPlayer };

type Props = {
  player: PremiumPlayerCardPlayer;
  /** Position · #Nr — falls nicht gesetzt aus player.position + jersey_number */
  subline?: string | null;
  density?: PremiumPlayerCardDensity;
  selected?: boolean;
  onClick?: () => void;
  /** Rechts: Badge, Trikot, Nummer, Chevron … */
  trailing?: React.ReactNode;
  /** Unter der Hauptzeile (z. B. Trainings-Buttons) */
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
  const avatarSize = density === 'compact' ? 'h-9 w-9' : 'h-10 w-10 sm:h-11 sm:w-11';

  const shellClass = premiumPlayerCardShellClass({
    selected,
    interactive: Boolean(onClick),
    density,
    className,
  });

  const body = (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(127,29,29,0.07),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex items-center gap-2.5">
        <div className={`relative shrink-0 ${avatarSize}`}>
          <img
            src={avatarSrc}
            alt=""
            className={`${avatarSize} rounded-full border border-white/10 object-cover bg-zinc-900/80`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const next = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (next) next.style.display = 'flex';
            }}
          />
          <div
            className={`hidden ${avatarSize} items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 text-[10px] font-bold text-white/80`}
          >
            {initials}
          </div>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className={premiumPlayerNameClass(density)}>{name}</p>
          <p className={premiumPlayerSublineClass()}>{sub}</p>
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
