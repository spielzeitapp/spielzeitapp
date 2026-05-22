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
  const pad = density === 'compact' ? 'px-2.5 py-2' : 'px-3 py-2.5';
  const isMatchday = tone === 'matchday';
  const highlighted = Boolean(opts?.active || opts?.selected);

  if (isMatchday) {
    return [
      'relative w-full overflow-hidden text-left',
      'rounded-[22px] border',
      'bg-gradient-to-br from-[#141416] via-[#0a0a0c] to-black',
      highlighted
        ? 'border-red-500/22 shadow-[0_6px_32px_rgba(0,0,0,0.52),0_0_32px_rgba(224,33,41,0.14)] ring-1 ring-red-500/22'
        : 'border-white/[0.08] shadow-[0_6px_28px_rgba(0,0,0,0.48),0_0_22px_rgba(224,33,41,0.06)]',
      pad,
      opts?.interactive
        ? 'cursor-pointer transition-[transform,box-shadow,border-color] duration-150 active:scale-[0.99] hover:border-red-500/18 hover:shadow-[0_8px_36px_rgba(0,0,0,0.55),0_0_28px_rgba(224,33,41,0.1)]'
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
    return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_0%_0%,rgba(224,33,41,0.14),transparent_58%),radial-gradient(ellipse_60%_50%_at_100%_100%,rgba(122,15,20,0.08),transparent_55%)]';
  }
  return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(127,29,29,0.07),transparent_55%)]';
}

export function premiumPlayerNameClass(
  density: PremiumPlayerCardDensity = 'default',
  tone: PremiumPlayerCardTone = 'utility',
): string {
  const size = density === 'compact' ? 'text-[14px]' : 'text-[15px] sm:text-[16px]';
  const weight = tone === 'matchday' ? 'font-bold' : 'font-semibold';
  return ['line-clamp-2 whitespace-normal break-words leading-snug text-white', size, weight].join(' ');
}

export function premiumPlayerSublineClass(tone: PremiumPlayerCardTone = 'utility'): string {
  if (tone === 'matchday') {
    return 'mt-0.5 truncate text-[11px] font-medium text-white/58';
  }
  return 'mt-0.5 truncate text-[11px] font-medium text-white/48';
}

export function premiumPlayerAvatarRingClass(tone: PremiumPlayerCardTone = 'utility'): string {
  if (tone === 'matchday') {
    return 'rounded-full border border-white/16 object-cover bg-zinc-900/80 shadow-[0_0_14px_rgba(224,33,41,0.12)] ring-1 ring-white/10';
  }
  return 'rounded-full border border-white/10 object-cover bg-zinc-900/80';
}

export function premiumJerseyNumberClass(tone: PremiumPlayerCardTone = 'utility'): string {
  if (tone === 'matchday') {
    return 'text-[12px] font-semibold tabular-nums text-red-300/55';
  }
  return 'text-[12px] font-semibold tabular-nums text-white/42';
}
