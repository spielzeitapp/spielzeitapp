/**
 * Compact roster row for Eltern & Spielerzugänge.
 */
import React from 'react';
import { Bell, BellOff, ChevronRight } from 'lucide-react';
import type { PlayerParentLinkRow } from '../../hooks/useTeamPlayerParentLinks';
import { PremiumPlayerCard } from '../player/PremiumPlayerCard';
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
    <PremiumPlayerCard
      player={{
        id: row.player_id,
        display_name: row.player_name,
        jersey_number: row.jersey_number,
        photo_url: src || null,
      }}
      subline={row.jersey_number != null ? `#${row.jersey_number}` : 'ohne Nummer'}
      density="compact"
      tone="utility"
      onClick={onOpen}
      className="py-2.5"
      sublineClassName="mt-0.5 truncate text-[11px] font-medium text-white/48"
      trailing={
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 text-right">
            <span
              className={pushActiveCount > 0
                ? 'flex items-center justify-end gap-1 text-[11px] font-semibold text-emerald-300'
                : 'flex items-center justify-end gap-1 text-[11px] font-medium text-white/45'}
            >
              <PushIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="max-w-[112px] truncate">{pushLabel}</span>
            </span>
            <span className="mt-1 block max-w-[112px] truncate text-[10px] text-white/38">
              {parentLine} · {appLine.primary}
            </span>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/35" aria-hidden />
        </div>
      }
     />
  );
}
