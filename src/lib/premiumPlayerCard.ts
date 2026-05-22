/** Premium Player Card — nutzt premiumDesignSystem als Single Source of Truth. */

import {
  dsAvatarBloomClass,
  dsAvatarRingClass,
  dsCardAmbientGlowClass,
  dsCardShellClass,
  dsJerseyNumberClass,
  dsPlayerNameClass,
  dsPlayerSublineClass,
  DS_AVATAR_SIZE,
  DS_CARD_FOOTER_DIVIDER,
  DS_CARD_INNER_GAP,
} from './premiumDesignSystem';

export type PremiumPlayerCardDensity = 'default' | 'compact';
/** matchday = etwas stärkere active-Tiefe; Geometrie identisch. */
export type PremiumPlayerCardTone = 'utility' | 'matchday';

export type PremiumPlayerCardPlayer = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  position?: string | null;
  jersey_number?: number | null;
  number?: number | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  photo_url?: string | null;
};

export function premiumPlayerDisplayName(player: PremiumPlayerCardPlayer): string {
  const first = (player.first_name ?? '').trim();
  const last = (player.last_name ?? '').trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const dn = (player.display_name ?? player.name ?? '').trim();
  return dn || 'Spieler';
}

export function premiumPlayerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

export function premiumPlayerAvatarSrc(player: PremiumPlayerCardPlayer): string {
  const raw = (player.avatar_url ?? player.avatarUrl ?? player.photo_url ?? '').trim();
  return raw || '/avatars/player-placeholder.png';
}

export function premiumPlayerAvatarSizeClass(): string {
  return DS_AVATAR_SIZE;
}

export function premiumPlayerCardShellClass(opts?: {
  tone?: PremiumPlayerCardTone;
  active?: boolean;
  selected?: boolean;
  interactive?: boolean;
  density?: PremiumPlayerCardDensity;
  className?: string;
}): string {
  const highlighted = Boolean(opts?.active || opts?.selected);
  return dsCardShellClass({
    active: highlighted,
    interactive: opts?.interactive,
    className: opts?.className,
  });
}

export function premiumPlayerCardGlowClass(): string {
  return dsCardAmbientGlowClass();
}

export function premiumPlayerNameClass(): string {
  return dsPlayerNameClass();
}

export function premiumPlayerSublineClass(): string {
  return dsPlayerSublineClass();
}

export function premiumPlayerAvatarRingClass(): string {
  return dsAvatarRingClass();
}

export function premiumPlayerAvatarBloomClass(): string {
  return dsAvatarBloomClass();
}

export function premiumJerseyNumberClass(): string {
  return dsJerseyNumberClass();
}

export { DS_CARD_FOOTER_DIVIDER, DS_CARD_INNER_GAP };
