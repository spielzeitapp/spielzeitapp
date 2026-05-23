/** Premium Player Card — nutzt premiumDesignSystem als Single Source of Truth. */

import {
  dsAvatarBloomClass,
  dsAvatarRingClass,
  dsCardAmbientGlowClass,
  dsCardShellClass,
  dsFeedAvatarBloomClass,
  dsFeedAvatarRingClass,
  dsFeedCardGlowClass,
  dsFeedCardShellClass,
  dsJerseyNumberClass,
  dsPlayerNameClass,
  dsPlayerSublineClass,
  DS_AVATAR_SIZE,
  DS_CARD_FOOTER_DIVIDER,
  DS_CARD_INNER_GAP,
  DS_FEED_CARD_FOOTER_DIVIDER,
} from './premiumDesignSystem';

export type PremiumPlayerCardDensity = 'default' | 'compact';
/** matchday = etwas stärkere active-Tiefe; feed = Home-Feed-Look (Training). */
export type PremiumPlayerCardTone = 'utility' | 'matchday' | 'feed';

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
  const tone = opts?.tone ?? 'utility';
  if (tone === 'feed') {
    return dsFeedCardShellClass(opts?.className);
  }
  return dsCardShellClass({
    active: highlighted,
    interactive: opts?.interactive,
    matchday: tone === 'matchday',
    className: opts?.className,
  });
}

export function premiumPlayerCardGlowClass(tone?: PremiumPlayerCardTone): string {
  if (tone === 'feed') return dsFeedCardGlowClass();
  return dsCardAmbientGlowClass(tone === 'matchday');
}

export function premiumPlayerCardFooterDividerClass(tone?: PremiumPlayerCardTone): string {
  return tone === 'feed' ? DS_FEED_CARD_FOOTER_DIVIDER : DS_CARD_FOOTER_DIVIDER;
}

export function premiumPlayerCardAvatarRingClass(tone?: PremiumPlayerCardTone): string {
  return tone === 'feed' ? dsFeedAvatarRingClass() : dsAvatarRingClass();
}

export function premiumPlayerCardAvatarBloomClass(tone?: PremiumPlayerCardTone): string {
  return tone === 'feed' ? dsFeedAvatarBloomClass() : dsAvatarBloomClass();
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
