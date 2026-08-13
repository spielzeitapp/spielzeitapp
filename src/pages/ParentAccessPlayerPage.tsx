/**
 * Eltern & Spielerzugänge — Spieler-Detail (eigene Route).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { normalizeRole, canViewParentLinks } from '../lib/roles';
import { dsPanelRowClass } from '../lib/premiumDesignSystem';
import { PageShell, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';
import { useTeamPlayerParentLinks } from '../hooks/useTeamPlayerParentLinks';
import { useTeamPlayerAppStatus } from '../hooks/useTeamPlayerAppStatus';
import { getPlayerAppStatusDisplay } from '../lib/playerAppStatus';
import { premiumPlayerInitials } from '../lib/premiumPlayerCard';
import { supabase } from '../lib/supabaseClient';
import { PlayerGuardiansPanel } from '../components/team/PlayerGuardiansPanel';
import { PlayerAccessQrPanel } from '../components/player/PlayerAccessQrPanel';
import { isPlayerQrAccessEnabled } from '../lib/playerAccessFeature';
import {
  buildParentReminderWhatsAppText,
  buildPushReminderText,
  parentPrimaryLabel,
} from '../hooks/useTeamPlayerParentLinks';

export const ParentAccessPlayerPage: React.FC = () => {
  const { playerId: rawPlayerId } = useParams<{ playerId: string }>();
  const playerId = (rawPlayerId ?? '').trim();
  const {
    teamSeasonId,
    teamLabelWithStatus,
    role,
    loading: tsLoading,
  } = useActiveTeamSeason();
  const roleNormalized = normalizeRole(role);
  const allowed = canViewParentLinks(roleNormalized);
  const dataActive = allowed && !tsLoading && Boolean(teamSeasonId);

  const {
    rows,
    loading: linksLoading,
    refetch: refetchParentLinks,
  } = useTeamPlayerParentLinks(teamSeasonId, dataActive);

  const { rows: appStatusRows } = useTeamPlayerAppStatus(teamSeasonId, dataActive);

  const row = useMemo(
    () => rows.find((r) => r.player_id === playerId) ?? null,
    [rows, playerId],
  );

  const appStatus = useMemo(
    () => appStatusRows.find((r) => r.player_id === playerId) ?? null,
    [appStatusRows, playerId],
  );

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!playerId) return;
    void (async () => {
      const { data } = await supabase
        .from('players')
        .select('avatar_url')
        .eq('id', playerId)
        .maybeSingle();
      if (!alive) return;
      const url = String((data as { avatar_url?: string | null } | null)?.avatar_url ?? '').trim();
      setPhotoUrl(url || null);
    })();
    return () => {
      alive = false;
    };
  }, [playerId]);

  if (!tsLoading && !allowed) {
    return <Navigate to="/app/mehr" replace />;
  }
  if (!playerId) {
    return <Navigate to="/app/mehr/parent-access" replace />;
  }

  const playerName = row?.player_name ?? 'Spieler';
  const initials = premiumPlayerInitials(playerName);
  const appDisplay = getPlayerAppStatusDisplay(
    appStatus?.app_status ?? 'not_setup',
    appStatus?.last_used_at ?? null,
  );
  const featureOn = isPlayerQrAccessEnabled();

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const handleReminder = async () => {
    const text = buildParentReminderWhatsAppText(playerName);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Erinnerungstext kopiert');
    } catch {
      showToast('Kopieren nicht möglich');
    }
  };

  const inactiveParent = row?.parents.find((p) => p.push_active !== true);
  const handlePushReminder = async () => {
    if (!inactiveParent) {
      showToast('Alle verknüpften Eltern haben Push aktiv.');
      return;
    }
    const text = buildPushReminderText(parentPrimaryLabel(inactiveParent), playerName);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Push-Erinnerung kopiert');
    } catch {
      showToast('Kopieren nicht möglich');
    }
  };

  return (
    <PageShell
      background="more"
      className="min-h-[60vh] w-full px-3 py-6 sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-lg space-y-4"
    >
      {toast ? (
        <div
          className="pointer-events-none fixed left-1/2 top-[max(1rem,env(safe-area-inset-top,0px))] z-[1001] -translate-x-1/2"
          role="status"
        >
          <div className="rounded-full border border-white/12 bg-[rgba(8,8,12,0.94)] px-4 py-2 text-[13px] font-medium text-white/92 shadow-lg">
            {toast}
          </div>
        </div>
      ) : null}

      <Link
        to="/app/mehr/parent-access"
        className={cn(dsPanelRowClass(), '!min-h-[40px] !py-2 text-sm font-semibold text-white/85')}
      >
        <span className="flex items-center gap-2">
          <ChevronLeft className="h-4 w-4 text-white/50" aria-hidden />
          Zurück zur Kaderliste
        </span>
      </Link>

      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/30 px-3 py-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/12 bg-gradient-to-br from-red-950/55 to-black/70">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[16px] font-bold text-white/75">
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <SectionTitle className="[&>h2]:text-xl [&>h2]:normal-case">{playerName}</SectionTitle>
          <p className="mt-0.5 text-[13px] text-white/60">
            {row?.jersey_number != null ? `#${row.jersey_number}` : 'ohne Nummer'}
            {teamLabelWithStatus ? ` · ${teamLabelWithStatus}` : ''}
          </p>
        </div>
      </div>

      {linksLoading && !row ? (
        <p className="text-[14px] text-white/60">Lade Spieler…</p>
      ) : !row ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[13px] text-amber-100">
          Spieler nicht im aktuellen Kader gefunden.
        </p>
      ) : (
        <>
          <section className="rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-3">
            <h3 className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-red-300/85">
              Spieler-App
            </h3>
            <p className="mt-2 text-[14px] font-semibold text-white/90">{appDisplay.headline}</p>
            {appDisplay.subline ? (
              <p className="mt-0.5 text-[12px] text-white/50">{appDisplay.subline}</p>
            ) : null}
            {featureOn ? (
              <div className="mt-3">
                <PlayerAccessQrPanel playerId={playerId} playerName={playerName} />
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-white/45">
                Code/PIN/QR-Verwaltung ist für dieses Team nicht freigeschaltet.
              </p>
            )}
          </section>

          <PlayerGuardiansPanel
            teamSeasonId={teamSeasonId!}
            playerId={playerId}
            playerName={playerName}
            parents={row.parents}
            onChanged={() => {
              void refetchParentLinks();
            }}
            onToast={showToast}
          />

          <section className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
            <h3 className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-white/50">
              Erinnerung
            </h3>
            <button
              type="button"
              onClick={() => void handleReminder()}
              className="mt-2 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[13px] font-semibold text-white/85"
            >
              WhatsApp-Erinnerung kopieren
            </button>
            {inactiveParent ? (
              <button
                type="button"
                onClick={() => void handlePushReminder()}
                className="mt-2 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[13px] font-semibold text-white/85"
              >
                Push-Erinnerung kopieren
              </button>
            ) : null}
          </section>
        </>
      )}
    </PageShell>
  );
};
