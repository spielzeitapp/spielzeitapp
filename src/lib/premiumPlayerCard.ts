/** Gemeinsame Premium-PlayerCard-Styles (Matchday Dark). */

export type PremiumPlayerCardDensity = 'default' | 'compact';

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
  selected?: boolean;
  interactive?: boolean;
  density?: PremiumPlayerCardDensity;
  className?: string;
}): string {
  const density = opts?.density ?? 'default';
  const pad = density === 'compact' ? 'px-2.5 py-2' : 'px-3 py-2.5';
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

export function premiumPlayerNameClass(density: PremiumPlayerCardDensity = 'default'): string {
  return [
    'line-clamp-2 whitespace-normal break-words font-semibold leading-snug text-white',
    density === 'compact' ? 'text-[14px]' : 'text-[15px] sm:text-[16px]',
  ].join(' ');
}

export function premiumPlayerSublineClass(): string {
  return 'mt-0.5 truncate text-[11px] font-medium text-white/48';
}

export function premiumJerseyNumberClass(): string {
  return 'text-[12px] font-semibold tabular-nums text-white/42';
}
