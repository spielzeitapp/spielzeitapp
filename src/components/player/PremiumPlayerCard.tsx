import React, { useState } from 'react';
import { getPositionLabel } from '../../lib/positionLabels';
import {
  DS_CARD_FOOTER_DIVIDER,
  DS_CARD_INNER_GAP,
  premiumPlayerAvatarSizeClass,
  premiumPlayerAvatarSrc,
  premiumPlayerCardAvatarBloomClass,
  premiumPlayerCardAvatarFrameClass,
  premiumPlayerCardAvatarMediaClass,
  premiumPlayerCardFooterDividerClass,
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
  nameClassName?: string;
  sublineClassName?: string;
  /** false = nur echtes Foto oder Initialen (kein Platzhalter-Bild). */
  avatarPlaceholder?: boolean;
};

function buildSubline(player: PremiumPlayerCardPlayer, override?: string | null): string {
  if (override != null && String(override).trim()) return String(override).trim();
  const pos = getPositionLabel(player.position) || (player.position ?? '').trim() || '—';
  const num = player.jersey_number ?? player.number;
  const numPart = num != null ? `#${num}` : null;
  return [pos !== '—' ? pos : null, numPart].filter(Boolean).join(' · ') || '—';
}

function PremiumCardAvatar({
  src,
  initials,
  tone,
  avatarSize,
}: {
  src: string | null;
  initials: string;
  tone: PremiumPlayerCardTone;
  avatarSize: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(src) && !imgFailed;
  const frameClass = premiumPlayerCardAvatarFrameClass(tone);
  const mediaClass = premiumPlayerCardAvatarMediaClass();
  const bloomClass = premiumPlayerCardAvatarBloomClass(tone);

  return (
    <div className={`relative shrink-0 ${avatarSize}`}>
      <div className={`${bloomClass} z-0`} aria-hidden />
      <div className={`relative z-[1] h-full w-full ${frameClass}`}>
        {showPhoto ? (
          <img
            src={src!}
            alt=""
            className={mediaClass}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white/70">
            {initials}
          </div>
        )}
      </div>
    </div>
  );
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
  nameClassName,
  sublineClassName,
  avatarPlaceholder = true,
}) => {
  const name = premiumPlayerDisplayName(player);
  const rawAvatar = (player.avatar_url ?? player.avatarUrl ?? player.photo_url ?? '').trim();
  const avatarSrc = avatarPlaceholder ? premiumPlayerAvatarSrc(player) : rawAvatar || null;
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
        <PremiumCardAvatar
          key={avatarSrc ?? `initials-${initials}`}
          src={avatarSrc}
          initials={initials}
          tone={tone}
          avatarSize={avatarSize}
        />
        <div className="min-w-0 flex-1 py-0.5 pr-1">
          <p className={nameClassName ?? premiumPlayerNameClass()}>{name}</p>
          <p className={sublineClassName ?? premiumPlayerSublineClass()}>{sub}</p>
        </div>
        {trailing ? <div className="flex shrink-0 flex-col items-end justify-center pl-0.5">{trailing}</div> : null}
      </div>
      {footer ? (
        <div className={`relative mt-2.5 pt-2.5 ${premiumPlayerCardFooterDividerClass(tone)}`}>{footer}</div>
      ) : null}
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
