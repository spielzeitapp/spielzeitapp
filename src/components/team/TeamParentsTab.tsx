/**
 * Eltern & Spielerzugänge — kompakte Kaderliste (Detail über eigene Route).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GlassCard,
  PremiumCard,
  PremiumEmptyState,
  PremiumTab,
  PremiumTabTrack,
  SectionTitle,
} from '../../ui';
import {
  PARENT_LINKS_RPC_MIGRATION_HINT,
  type PlayerParentLinkRow,
} from '../../hooks/useTeamPlayerParentLinks';
import {
  PLAYER_APP_STATUS_RPC_MIGRATION_HINT,
  playerAppStatusMap,
  type PlayerAppStatusRow,
} from '../../lib/playerAppStatus';
import { listParentLinkInvitesForPlayer } from '../../lib/parentLinkInvites';
import { supabase } from '../../lib/supabaseClient';
import {
  ParentAccessPlayerRow,
  type ParentAccessRosterFilter,
} from './ParentAccessPlayerRow';

type TeamParentsTabProps = {
  teamSeasonId: string | null;
  tsLoading: boolean;
  rows: PlayerParentLinkRow[];
  loading: boolean;
  error: string | null;
  rpcMissing: boolean;
  appStatusRows: PlayerAppStatusRow[];
  appStatusLoading: boolean;
  appStatusError: string | null;
  appStatusRpcMissing: boolean;
  onLinksChanged?: () => void;
  teamSeasonLabel?: string | null;
  focusPlayerId?: string | null;
};

export const TeamParentsTab: React.FC<TeamParentsTabProps> = ({
  teamSeasonId,
  tsLoading,
  rows,
  loading,
  error,
  rpcMissing,
  appStatusRows,
  appStatusLoading,
  appStatusError,
  appStatusRpcMissing,
  teamSeasonLabel = null,
  focusPlayerId = null,
}) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ParentAccessRosterFilter>('all');
  const [search, setSearch] = useState('');
  const [openInviteByPlayer, setOpenInviteByPlayer] = useState<Record<string, number>>({});
  const [photoByPlayer, setPhotoByPlayer] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!focusPlayerId) return;
    navigate(`/app/mehr/parent-access/player/${encodeURIComponent(focusPlayerId)}`, {
      replace: true,
    });
  }, [focusPlayerId, navigate]);

  useEffect(() => {
    let alive = true;
    async function loadOpenInvites() {
      if (!teamSeasonId || rows.length === 0) {
        if (alive) setOpenInviteByPlayer({});
        return;
      }
      const entries = await Promise.all(
        rows.map(async (row) => {
          const res = await listParentLinkInvitesForPlayer({
            teamSeasonId,
            playerId: row.player_id,
          });
          const open = res.invites.filter((i) => i.state === 'open').length;
          return [row.player_id, open] as const;
        }),
      );
      if (!alive) return;
      const next: Record<string, number> = {};
      for (const [id, n] of entries) next[id] = n;
      setOpenInviteByPlayer(next);
    }
    void loadOpenInvites();
    return () => {
      alive = false;
    };
  }, [teamSeasonId, rows]);

  useEffect(() => {
    let alive = true;
    async function loadPhotos() {
      const ids = rows.map((r) => r.player_id).filter(Boolean);
      if (ids.length === 0) {
        if (alive) setPhotoByPlayer({});
        return;
      }
      const { data, error: photoErr } = await supabase
        .from('players')
        .select('id, avatar_url')
        .in('id', ids);
      if (!alive) return;
      if (photoErr || !data) {
        setPhotoByPlayer({});
        return;
      }
      const map: Record<string, string> = {};
      for (const row of data as Array<{ id?: string; avatar_url?: string | null }>) {
        const id = String(row.id ?? '');
        const url = String(row.avatar_url ?? '').trim();
        if (id && url) map[id] = url;
      }
      setPhotoByPlayer(map);
    }
    void loadPhotos();
    return () => {
      alive = false;
    };
  }, [rows]);

  const linkedCount = useMemo(() => rows.filter((r) => r.parent_count > 0).length, [rows]);
  const missingCount = useMemo(
    () =>
      rows.filter((r) => r.parent_count === 0 && (openInviteByPlayer[r.player_id] ?? 0) === 0)
        .length,
    [rows, openInviteByPlayer],
  );
  const openInvitePlayerCount = useMemo(
    () => rows.filter((r) => (openInviteByPlayer[r.player_id] ?? 0) > 0).length,
    [rows, openInviteByPlayer],
  );

  const appStatusByPlayer = useMemo(() => playerAppStatusMap(appStatusRows), [appStatusRows]);
  const appMissingCount = useMemo(
    () =>
      rows.filter((r) => (appStatusByPlayer.get(r.player_id)?.app_status ?? 'not_setup') === 'not_setup')
        .length,
    [rows, appStatusByPlayer],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (filter === 'linked') list = rows.filter((r) => r.parent_count > 0);
    else if (filter === 'missing') {
      list = rows.filter(
        (r) => r.parent_count === 0 && (openInviteByPlayer[r.player_id] ?? 0) === 0,
      );
    } else if (filter === 'open') {
      list = rows.filter((r) => (openInviteByPlayer[r.player_id] ?? 0) > 0);
    } else if (filter === 'app_missing') {
      list = rows.filter(
        (r) => (appStatusByPlayer.get(r.player_id)?.app_status ?? 'not_setup') === 'not_setup',
      );
    }
    if (q) {
      list = list.filter(
        (r) =>
          r.player_name.toLowerCase().includes(q) ||
          (r.jersey_number != null && String(r.jersey_number).includes(q)),
      );
    }
    return [...list].sort((a, b) => {
      const ja = a.jersey_number ?? 9999;
      const jb = b.jersey_number ?? 9999;
      if (ja !== jb) return ja - jb;
      return a.player_name.localeCompare(b.player_name, 'de');
    });
  }, [rows, filter, search, openInviteByPlayer, appStatusByPlayer]);

  const openDetail = (playerId: string) => {
    navigate(`/app/mehr/parent-access/player/${encodeURIComponent(playerId)}`);
  };

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className="min-w-0 overflow-hidden sm:p-5">
      <SectionTitle
        as="h2"
        className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case"
      >
        Eltern &amp; Spielerzugänge
      </SectionTitle>
      {teamSeasonLabel ? (
        <p className="mt-1 text-[13px] font-medium text-white/75">{teamSeasonLabel}</p>
      ) : null}
      <p className="mt-1 text-[13px] text-white/60">
        Kaderübersicht — Tippe auf einen Spieler für Details und Einladungen.
      </p>

      {teamSeasonId == null && !tsLoading ? (
        <PremiumEmptyState variant="subtle" title="Bitte Team wählen." className="mt-3 py-6" />
      ) : loading ? (
        <p className="mt-4 text-[14px] text-white/70">Lade Kader…</p>
      ) : error ? (
        <p
          className="mt-4 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-[14px] text-red-300"
          role="alert"
        >
          {error}
        </p>
      ) : rows.length === 0 ? (
        <PremiumEmptyState variant="subtle" title="Noch keine Spieler angelegt." className="mt-4 py-6" />
      ) : (
        <div className="mt-4 min-w-0 space-y-3 sm:space-y-4">
          {rpcMissing ? (
            <p className="rounded-lg border border-amber-500/35 bg-amber-950/35 px-3 py-2 text-[13px] text-amber-100/95">
              {PARENT_LINKS_RPC_MIGRATION_HINT}
            </p>
          ) : null}
          {appStatusRpcMissing ? (
            <p className="rounded-lg border border-amber-500/35 bg-amber-950/35 px-3 py-2 text-[13px] text-amber-100/95">
              {PLAYER_APP_STATUS_RPC_MIGRATION_HINT}
            </p>
          ) : null}
          {appStatusError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-[13px] text-red-200/90">
              {appStatusError}
            </p>
          ) : null}

          <GlassCard variant="subtle" showAmbientGlow={false} className="min-w-0 px-3 py-3 sm:px-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-white/85">
              <span>
                <span className="font-bold text-white">{rows.length}</span> Spieler
              </span>
              <span className="text-emerald-300">
                <span className="font-bold">{linkedCount}</span> verknüpft
              </span>
              <span className="text-sky-300">
                <span className="font-bold">{openInvitePlayerCount}</span> offen
              </span>
              <span className="text-amber-300">
                <span className="font-bold">{missingCount}</span> ohne Eltern
              </span>
            </div>
          </GlassCard>

          <label className="block min-w-0">
            <span className="sr-only">Spieler suchen</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Spieler oder Nummer suchen…"
              className="h-11 w-full rounded-xl border border-white/12 bg-black/30 px-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />
          </label>

          <PremiumTabTrack className="min-w-0">
            <PremiumTab
              kind="filter"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
            >
              Alle ({rows.length})
            </PremiumTab>
            <PremiumTab
              kind="filter"
              active={filter === 'missing'}
              onClick={() => setFilter('missing')}
              className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
            >
              Eltern fehlen ({missingCount})
            </PremiumTab>
            <PremiumTab
              kind="filter"
              active={filter === 'open'}
              onClick={() => setFilter('open')}
              className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
            >
              Einladung offen ({openInvitePlayerCount})
            </PremiumTab>
            <PremiumTab
              kind="filter"
              active={filter === 'linked'}
              onClick={() => setFilter('linked')}
              className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
            >
              Eltern verknüpft ({linkedCount})
            </PremiumTab>
            <PremiumTab
              kind="filter"
              active={filter === 'app_missing'}
              onClick={() => setFilter('app_missing')}
              className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
            >
              Spieler-App fehlt ({appMissingCount})
            </PremiumTab>
          </PremiumTabTrack>

          {appStatusLoading ? (
            <p className="text-[12px] text-white/50">Lade Spieler-App-Status…</p>
          ) : null}

          {filteredRows.length === 0 ? (
            <PremiumEmptyState
              variant="subtle"
              title="Keine Spieler für diesen Filter."
              className="py-6"
            />
          ) : (
            <ul className="space-y-2">
              {filteredRows.map((row) => {
                const app = appStatusByPlayer.get(row.player_id);
                return (
                  <li key={row.player_id}>
                    <ParentAccessPlayerRow
                      row={row}
                      openInviteCount={openInviteByPlayer[row.player_id] ?? 0}
                      appStatus={app?.app_status}
                      lastUsedAt={app?.last_used_at ?? null}
                      photoUrl={photoByPlayer[row.player_id] ?? null}
                      onOpen={() => openDetail(row.player_id)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </PremiumCard>
  );
};
