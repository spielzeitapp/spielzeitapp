/**
 * Compact roster row for Eltern & Spielerzugänge.
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { premiumPlayerInitials } from '../../lib/premiumPlayerCard';
import type { PlayerParentLinkRow } from '../../hooks/useTeamPlayerParentLinks';
import {
  formatPlayerAppLastUsed,
  type PlayerAppStatus,
} from '../../lib/playerAppStatus';

export type ParentAccessRosterFilter =
  | 'all'
  | 'missing'
  | 'open'
  | 'linked'
  | 'app_missing';

export function parentStatusLine(opts: {
  parentCount: number;
  openInviteCount: number;
}): string {
  const parts: string[] = [];
  if (opts.parentCount <= 0) {
    parts.push('Keine Eltern');
  } else if (opts.parentCount === 1) {
    parts.push('1 verknüpft');
  } else {
    parts.push(`${opts.parentCount} verknüpft`);
  }
  if (opts.openInviteCount === 1) parts.push('1 Einladung offen');
  else if (opts.openInviteCount > 1) parts.push(`${opts.openInviteCount} Einladungen offen`);
  return parts.join(' · ');
}

export function playerAppStatusLine(
  status: PlayerAppStatus | undefined,
  lastUsedAt: string | null | undefined,
): { primary: string; secondary: string | null } {
  if (status === 'active') {
    const last = formatPlayerAppLastUsed(lastUsedAt);
    return {
      primary: 'Spieler-App verbunden',
      secondary: last ? `Zuletzt: ${last}` : null,
    };
  }
  if (status === 'created') {
    return { primary: 'Spieler-App eingerichtet', secondary: 'Noch nicht angemeldet' };
  }
  return { primary: 'Spieler-App fehlt', secondary: null };
}

type ParentAccessPlayerRowProps = {
  row: PlayerParentLinkRow;
  openInviteCount: number;
  appStatus?: PlayerAppStatus;
  lastUsedAt?: string | null;
  photoUrl?: string | null;
  onOpen: () => void;
};

export function ParentAccessPlayerRow(props: ParentAccessPlayerRowProps): React.ReactElement {
  const { row, openInviteCount, appStatus, lastUsedAt, photoUrl, onOpen } = props;
  const parentLine = parentStatusLine({
    parentCount: row.parent_count,
    openInviteCount,
  });
  const appLine = playerAppStatusLine(appStatus, lastUsedAt);
  const initials = premiumPlayerInitials(row.player_name);
  const src = (photoUrl ?? '').trim();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full min-h-[72px] items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-left transition hover:border-white/16 hover:bg-black/45 active:scale-[0.995]"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/12 bg-gradient-to-br from-red-950/55 to-black/70">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[13px] font-bold uppercase tracking-wide text-white/75">
            {initials}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-white">{row.player_name}</p>
        <p className="mt-0.5 text-[12px] text-white/55">
          {row.jersey_number != null ? `#${row.jersey_number}` : 'ohne Nummer'}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-white/70">{parentLine}</p>
        <p className="truncate text-[11px] text-white/45">
          {appLine.primary}
          {appLine.secondary ? ` · ${appLine.secondary}` : ''}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/35" aria-hidden />
    </button>
  );
}
