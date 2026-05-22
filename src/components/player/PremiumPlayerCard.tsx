import React from 'react';
import { getPositionLabel } from '../../lib/positionLabels';
import {
  DS_CARD_FOOTER_DIVIDER,
  DS_CARD_INNER_GAP,
  premiumPlayerAvatarBloomClass,
  premiumPlayerAvatarRingClass,
  premiumPlayerAvatarSizeClass,
  premiumPlayerAvatarSrc,
  premiumPlayerCardGlowClass,
  premiumPlayerCardShellClass,
  premiumPlayerDisplayName,
  premiumPlayerInitials,
  premiumPlayerNameClass,
  premiumPlayerSublineClass,
  type PremiumPlayerCardPlayer,
  type PremiumPlayerCardTone,
} from '../../lib/premiumPlayerCard';
export type { PremiumPlayerCardPlayer, PremiumPlayerCardTone };

type Props = {
  player: PremiumPlayerCardPlayer;
  subline?: string | null;
  density?: 'default' | 'compact';
  tone?: PremiumPlayerCardTone;
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
  const avatarSize = premiumPlayerAvatarSizeClass();
  const highlighted = active || selected;

  const shellClass = premiumPlayerCardShellClass({
    tone,
    active: highlighted,
    selected: highlighted,
    interactive: Boolean(onClick),
    className,
  });

  const body = (
    <>
      <div className={premiumPlayerCardGlowClass(tone)} aria-hidden />
      <div className={`relative flex items-center ${DS_CARD_INNER_GAP}`}>
        <div className={`relative shrink-0 ${avatarSize}`}>
          <div className={premiumPlayerAvatarBloomClass()} aria-hidden />
          <img
            src={avatarSrc}
            alt=""
            className={`relative z-[1] ${avatarSize} ${premiumPlayerAvatarRingClass()}`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const next = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (next) next.style.display = 'flex';
            }}
          />
          <div
            className={`relative z-[1] hidden ${avatarSize} items-center justify-center rounded-full border border-[#2a2a2e] bg-[#0a0a0b] text-[11px] font-semibold text-white/70`}
          >
            {initials}
          </div>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className={premiumPlayerNameClass()}>{name}</p>
          <p className={premiumPlayerSublineClass()}>{sub}</p>
        </div>
        {trailing ? <div className="flex shrink-0 flex-col items-end justify-center gap-1">{trailing}</div> : null}
      </div>
      {footer ? <div className={`relative mt-2 pt-2 ${DS_CARD_FOOTER_DIVIDER}`}>{footer}</div> : null}
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
