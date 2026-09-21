/**
 * Compact roster row for Eltern & Spielerzugänge.
 */
import React, { useState } from 'react';
import { Bell, BellOff, ChevronRight } from 'lucide-react';
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
  const src = (photoUrl ?? '').trim();
  const [imageFailed, setImageFailed] = useState(false);
  const nameParts = row.player_name.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || 'Spieler';
  const familyName = nameParts.slice(1).join(' ');
  const goalkeeper = row.jersey_number === 1 || row.jersey_number === 21;
  const fallbackSrc = goalkeeper
    ? '/avatars/player-placeholder-goalkeeper.png'
    : '/avatars/player-placeholder.png';
  const pushActiveCount = row.parents.filter((parent) => parent.push_active === true).length;
  const pushLabel = row.parent_count <= 0
    ? 'Kein Elternzugang'
    : pushActiveCount === row.parent_count
      ? 'Push aktiv'
      : pushActiveCount > 0
        ? `${pushActiveCount}/${row.parent_count} Push aktiv`
        : 'Push nicht aktiviert';
  const PushIcon = pushActiveCount > 0 ? Bell : BellOff;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="sz-club-list-card sz-club-surface sz-club-surface--quiet flex min-h-[82px] w-full items-center overflow-hidden rounded-[14px] border px-2.5 text-left transition active:scale-[0.99]"
    >
      <div className="relative mr-2.5 h-[72px] w-[58px] shrink-0 self-end overflow-hidden">
        <img
          src={!imageFailed && src ? src : fallbackSrc}
          alt=""
          onError={() => setImageFailed(true)}
          className="h-full w-full origin-top scale-[1.75] object-contain object-top"
        />
      </div>
      <span className="sz-club-number-divider w-12 shrink-0 border-l pl-2.5 text-[25px] font-black leading-none text-white">
        {row.jersey_number ?? '–'}
      </span>
      <span className="min-w-0 flex-1 pl-2.5">
        <span className="block truncate text-[13px] font-semibold leading-tight text-white/55">
          {firstName}
        </span>
        <span className="block truncate text-[17px] font-black leading-tight text-white">
          {familyName || row.player_name}
        </span>
        <span
          className={pushActiveCount > 0
            ? 'mt-1 flex items-center gap-1 truncate text-[10px] font-semibold leading-tight text-emerald-300'
            : 'mt-1 flex items-center gap-1 truncate text-[10px] font-medium leading-tight text-white/42'}
          title={`${pushLabel} · ${parentLine} · ${appLine.primary}`}
        >
          <PushIcon className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{pushLabel} · {parentLine}</span>
        </span>
      </span>
      <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-white/65" aria-hidden />
    </button>
  );
}
