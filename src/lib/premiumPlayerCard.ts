/** Gemeinsame Premium-PlayerCard-Styles (Matchday Dark). */

export type PremiumPlayerCardDensity = 'default' | 'compact';
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

/** Matchday: 64–72px Hero-Avatar; Utility: kompakt. */
export function premiumPlayerAvatarSizeClass(
  tone: PremiumPlayerCardTone = 'utility',
  density: PremiumPlayerCardDensity = 'default',
): string {
  if (tone === 'matchday') {
    return 'h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]';
  }
  return density === 'compact' ? 'h-9 w-9' : 'h-10 w-10 sm:h-11 sm:w-11';
}

const MATCHDAY_SHELL_SHADOW =
  'shadow-[0_8px_32px_rgba(0,0,0,0.62),0_0_36px_rgba(224,33,41,0.07),inset_0_1px_0_rgba(255,255,255,0.015)]';
const MATCHDAY_SHELL_SHADOW_ACTIVE =
  'shadow-[0_10px_40px_rgba(0,0,0,0.68),0_0_44px_rgba(224,33,41,0.14),inset_0_1px_0_rgba(255,255,255,0.02)]';

export function premiumPlayerCardShellClass(opts?: {
  tone?: PremiumPlayerCardTone;
  active?: boolean;
  selected?: boolean;
  interactive?: boolean;
  density?: PremiumPlayerCardDensity;
  className?: string;
}): string {
  const tone = opts?.tone ?? 'utility';
  const density = opts?.density ?? 'default';
  const isMatchday = tone === 'matchday';
  const pad = isMatchday
    ? 'px-2.5 py-2'
    : density === 'compact'
      ? 'px-2.5 py-2'
      : 'px-3 py-2.5';
  const highlighted = Boolean(opts?.active || opts?.selected);

  if (isMatchday) {
    return [
      'relative w-full overflow-hidden text-left',
      'rounded-[22px] border border-transparent',
      'bg-gradient-to-br from-[#101012] via-[#08080a] to-black',
      highlighted ? MATCHDAY_SHELL_SHADOW_ACTIVE : MATCHDAY_SHELL_SHADOW,
      pad,
      opts?.interactive
        ? 'cursor-pointer transition-[transform,box-shadow] duration-200 active:scale-[0.99] hover:shadow-[0_10px_38px_rgba(0,0,0,0.66),0_0_40px_rgba(224,33,41,0.11)]'
        : '',
      opts?.className ?? '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    'relative w-full overflow-hidden text-left',
    'rounded-[22px] border',
    'bg-gradient-to-br from-[#0e0e10] via-[#08080a] to-black',
    'shadow-[0_6px_28px_rgba(0,0,0,0.42)]',
    opts?.selected
      ? 'border-white/12 ring-1 ring-red-500/20'
      : 'border-white/[0.06]',
    pad,
    opts?.interactive
      ? 'cursor-pointer transition-[transform,box-shadow,border-color] duration-150 active:scale-[0.99] hover:border-white/10 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
      : '',
    opts?.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function premiumPlayerCardGlowClass(tone: PremiumPlayerCardTone = 'utility'): string {
  if (tone === 'matchday') {
    return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_75%_at_8%_0%,rgba(224,33,41,0.11),transparent_62%),radial-gradient(ellipse_55%_45%_at_100%_100%,rgba(122,15,20,0.06),transparent_58%)]';
  }
  return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(127,29,29,0.07),transparent_55%)]';
}

export function premiumPlayerNameClass(
  density: PremiumPlayerCardDensity = 'default',
  tone: PremiumPlayerCardTone = 'utility',
): string {
  const size =
    tone === 'matchday'
      ? 'text-[15px] sm:text-[16px]'
      : density === 'compact'
        ? 'text-[14px]'
        : 'text-[15px] sm:text-[16px]';
  const weight = tone === 'matchday' ? 'font-bold' : 'font-semibold';
  return ['line-clamp-2 whitespace-normal break-words leading-snug text-white', size, weight].join(' ');
}

export function premiumPlayerSublineClass(tone: PremiumPlayerCardTone = 'utility'): string {
  if (tone === 'matchday') {
    return 'mt-0.5 truncate text-[11px] font-medium text-white/52';
  }
  return 'mt-0.5 truncate text-[11px] font-medium text-white/48';
}

export function premiumPlayerAvatarRingClass(tone: PremiumPlayerCardTone = 'utility'): string {
  if (tone === 'matchday') {
    return 'rounded-full border border-[#2a1216]/90 object-cover bg-zinc-950/95 shadow-[0_0_22px_rgba(224,33,41,0.14),0_4px_16px_rgba(0,0,0,0.45)]';
  }
  return 'rounded-full border border-white/10 object-cover bg-zinc-900/80';
}

export function premiumPlayerAvatarBloomClass(): string {
  return 'pointer-events-none absolute -inset-1 rounded-full bg-[radial-gradient(circle,rgba(224,33,41,0.22)_0%,rgba(122,15,20,0.08)_45%,transparent_70%)] blur-[7px]';
}

export function premiumJerseyNumberClass(tone: PremiumPlayerCardTone = 'utility'): string {
  if (tone === 'matchday') {
    return 'text-[11px] font-medium tabular-nums text-white/32';
  }
  return 'text-[12px] font-semibold tabular-nums text-white/42';
}
