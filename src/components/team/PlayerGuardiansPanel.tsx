import React, { useCallback, useEffect, useState } from 'react';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import {
  fetchTeamPlayerParentLinks,
  parentPrimaryLabel,
  parentShowEmailBelow,
  type ParentLinkInfo,
} from '../../hooks/useTeamPlayerParentLinks';
import {
  guardianDisplayLabel,
  unlinkPlayerGuardian,
} from '../../lib/playerGuardians';
import { LinkGuardianSheet } from './LinkGuardianSheet';

type PlayerGuardiansPanelProps = {
  teamSeasonId: string;
  playerId: string;
  playerName: string;
  /** Wenn gesetzt: Elternliste von außen (z. B. TeamParentsTab). */
  parents?: ParentLinkInfo[] | null;
  onChanged?: () => void;
  onToast?: (message: string) => void;
  className?: string;
};

export const PlayerGuardiansPanel: React.FC<PlayerGuardiansPanelProps> = ({
  teamSeasonId,
  playerId,
  playerName,
  parents: parentsProp,
  onChanged,
  onToast,
  className = '',
}) => {
  const [parents, setParents] = useState<ParentLinkInfo[]>(parentsProp ?? []);
  const [loading, setLoading] = useState(parentsProp == null);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (parentsProp != null) {
      setParents(parentsProp);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await fetchTeamPlayerParentLinks(teamSeasonId);
    if (result.error) {
      setParents([]);
      setError(result.error);
      setLoading(false);
      return;
    }
    const row = result.rows.find((r) => r.player_id === playerId);
    setParents(row?.parents ?? []);
    setLoading(false);
  }, [teamSeasonId, playerId, parentsProp]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (parentsProp != null) setParents(parentsProp);
  }, [parentsProp]);

  const toast = (msg: string) => {
    onToast?.(msg);
  };

  const handleUnlink = async (parent: ParentLinkInfo) => {
    if (busyUserId) return;
    const parentLabel = parentPrimaryLabel(parent);
    const playerLabel = playerName.trim() || 'Spieler';
    const ok = window.confirm(
      `Verknüpfung entfernen?\n\n${parentLabel} wird von ${playerLabel} getrennt.\nKonto, Profil und Zu-/Absagen bleiben erhalten.`,
    );
    if (!ok) return;

    setBusyUserId(parent.user_id);
    const result = await unlinkPlayerGuardian({
      teamSeasonId,
      playerId,
      parentUserId: parent.user_id,
    });
    setBusyUserId(null);

    if (result.status === 'unlinked' || result.status === 'not_linked') {
      toast(
        `${guardianDisplayLabel(result.displayName ?? parentLabel, parent.email)} wurde von ${playerLabel} getrennt.`,
      );
      onChanged?.();
      if (parentsProp == null) void load();
      return;
    }
    toast(result.message ?? 'Entfernen fehlgeschlagen.');
  };

  return (
    <section className={`min-w-0 ${className}`.trim()} aria-labelledby={`guardians-${playerId}`}>
      <div className="flex items-center justify-between gap-2">
        <h3
          id={`guardians-${playerId}`}
          className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-red-300/85"
        >
          Eltern &amp; Erziehungsberechtigte
        </h3>
      </div>

      {loading ? (
        <p className="mt-2 text-[13px] text-white/55">Lade Verknüpfungen…</p>
      ) : error ? (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-950/30 px-2.5 py-2 text-[13px] text-red-200" role="alert">
          {error}
        </p>
      ) : parents.length === 0 ? (
        <p className="mt-2 text-[13px] text-white/55">Noch kein Elternaccount verknüpft.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {parents.map((parent) => (
            <li
              key={parent.user_id}
              className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5"
            >
              <p className="text-[15px] font-semibold text-white">{parentPrimaryLabel(parent)}</p>
              {parentShowEmailBelow(parent) ? (
                <p className="mt-0.5 truncate text-[12px] text-white/55">{parent.email}</p>
              ) : null}
              <button
                type="button"
                disabled={busyUserId === parent.user_id}
                onClick={() => void handleUnlink(parent)}
                className={`mt-2 w-full ${dsSecondaryCtaClass()} !min-h-[40px] !rounded-xl !py-2 !text-[13px] disabled:opacity-50`}
              >
                {busyUserId === parent.user_id ? 'Entferne…' : 'Verknüpfung entfernen'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setLinkOpen(true)}
        className={`mt-3 w-full ${dsPrimaryCtaClass()} !min-h-[44px] !rounded-xl !text-[14px]`}
      >
        Elternteil verknüpfen
      </button>

      <LinkGuardianSheet
        open={linkOpen}
        teamSeasonId={teamSeasonId}
        playerId={playerId}
        playerName={playerName}
        onClose={() => setLinkOpen(false)}
        onLinked={(message) => {
          toast(message);
          onChanged?.();
          if (parentsProp == null) void load();
        }}
      />
    </section>
  );
};
