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
import {
  createParentLinkInvite,
  listParentLinkInvitesForPlayer,
  parentInviteStateLabel,
  revokeParentLinkInvite,
  sendParentEmailInvite,
  type ParentInviteInfo,
} from '../../lib/parentLinkInvites';
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
  const [invites, setInvites] = useState<ParentInviteInfo[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [lastSendMasked, setLastSendMasked] = useState<string | null>(null);
  const [lastSendAt, setLastSendAt] = useState<string | null>(null);
  const [lastExpiresAt, setLastExpiresAt] = useState<string | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [freshExpiresAt, setFreshExpiresAt] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    const result = await listParentLinkInvitesForPlayer({ teamSeasonId, playerId });
    if (result.error) {
      setInvites([]);
      return;
    }
    setInvites(result.invites);
  }, [teamSeasonId, playerId]);

  const load = useCallback(async () => {
    if (parentsProp != null) {
      setParents(parentsProp);
      setLoading(false);
      setError(null);
      void loadInvites();
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
    void loadInvites();
  }, [teamSeasonId, playerId, parentsProp, loadInvites]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (parentsProp != null) setParents(parentsProp);
  }, [parentsProp]);

  const toast = (msg: string) => {
    onToast?.(msg);
  };

  const handleSendEmailInvite = async () => {
    if (inviteBusy) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }
    setInviteBusy(true);
    setFreshToken(null);
    setFreshExpiresAt(null);
    const result = await sendParentEmailInvite({
      teamSeasonId,
      playerId,
      email,
    });
    setInviteBusy(false);

    if (!result.ok) {
      toast(result.message ?? 'Einladung fehlgeschlagen.');
      return;
    }

    setLastSendMasked(result.recipientEmailMasked);
    setLastSendAt(new Date().toISOString());
    setLastExpiresAt(result.expiresAt);

    if (result.emailSent) {
      toast(`Einladung an ${result.recipientEmailMasked ?? 'Eltern'} gesendet.`);
    } else {
      setFreshToken(result.codeFallback);
      setFreshExpiresAt(result.expiresAt);
      toast(
        'E-Mail-Versand nicht möglich — Einladungscode als Fallback erstellt. Bitte manuell weitergeben.',
      );
    }
    void loadInvites();
  };

  const handleCreateCodeInvite = async () => {
    if (inviteBusy) return;
    setInviteBusy(true);
    setFreshToken(null);
    setFreshExpiresAt(null);
    const result = await createParentLinkInvite({ teamSeasonId, playerId });
    setInviteBusy(false);
    if (result.status !== 'created' || !result.tokenPlain) {
      toast(result.message ?? 'Einladung fehlgeschlagen.');
      return;
    }
    setFreshToken(result.tokenPlain);
    setFreshExpiresAt(result.expiresAt);
    toast(`Einladungscode für ${playerName.trim() || 'Spieler'} erstellt.`);
    void loadInvites();
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (inviteBusy) return;
    setInviteBusy(true);
    const result = await revokeParentLinkInvite(inviteId);
    setInviteBusy(false);
    if (result.status !== 'revoked') {
      toast(result.message ?? 'Widerruf fehlgeschlagen.');
      return;
    }
    toast('Einladung widerrufen.');
    if (freshToken) {
      setFreshToken(null);
      setFreshExpiresAt(null);
    }
    void loadInvites();
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
                {busyUserId === parent.user_id ? 'Entferne…' : 'Verknüpfung aufheben'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-red-300/85">
          Eltern einladen
        </p>
        <p className="mt-1 text-[12px] text-white/55">
          E-Mail-Einladung mit sicherem Link — getrennt vom Spielerzugang (Code/PIN/QR).
        </p>

        <label className="mt-3 block text-[12px] text-white/70" htmlFor={`parent-invite-email-${playerId}`}>
          E-Mail-Adresse des Elternteils
        </label>
        <input
          id={`parent-invite-email-${playerId}`}
          type="email"
          autoComplete="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="eltern@example.com"
          className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-[14px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/50"
        />

        <button
          type="button"
          disabled={inviteBusy || !inviteEmail.trim()}
          onClick={() => void handleSendEmailInvite()}
          className={`mt-2.5 w-full ${dsPrimaryCtaClass()} !min-h-[44px] !rounded-xl !text-[14px] disabled:opacity-50`}
        >
          {inviteBusy ? 'Sende…' : 'Einladung per E-Mail senden'}
        </button>

        {lastSendMasked ? (
          <div className="mt-2.5 rounded-lg border border-emerald-500/25 bg-emerald-950/25 px-2.5 py-2 text-[12px] text-emerald-100/90">
            <p>
              Status: <span className="font-semibold">Gesendet</span> an {lastSendMasked}
            </p>
            {lastSendAt ? (
              <p className="mt-0.5 text-white/50">
                Versand: {new Date(lastSendAt).toLocaleString('de-AT')}
              </p>
            ) : null}
            {lastExpiresAt ? (
              <p className="text-white/50">
                Gültig bis {new Date(lastExpiresAt).toLocaleString('de-AT')}
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          disabled={inviteBusy}
          onClick={() => void handleCreateCodeInvite()}
          className={`mt-2 w-full ${dsSecondaryCtaClass()} !min-h-[40px] !rounded-xl !py-2 !text-[13px] disabled:opacity-50`}
        >
          {inviteBusy ? 'Erstelle…' : 'Einladungscode erstellen'}
        </button>

        {freshToken ? (
          <div className="mt-2.5 rounded-lg border border-amber-500/25 bg-amber-950/20 px-2.5 py-2">
            <p className="text-[11px] text-amber-100/80">
              Code-Fallback — nur jetzt sichtbar (WhatsApp / persönliche Übergabe):
            </p>
            <p className="mt-1 break-all font-mono text-[12px] text-amber-50">{freshToken}</p>
            {freshExpiresAt ? (
              <p className="mt-1 text-[11px] text-white/50">
                Gültig bis {new Date(freshExpiresAt).toLocaleString('de-AT')}
              </p>
            ) : null}
          </div>
        ) : null}

        {invites.length > 0 ? (
          <ul className="mt-2.5 space-y-1.5">
            {invites.slice(0, 6).map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="text-[12px] text-white/80">
                    {parentInviteStateLabel(invite.state)}
                    {invite.channel === 'email' ? ' · E-Mail' : ' · Code'}
                    {invite.recipientEmailMasked ? ` · ${invite.recipientEmailMasked}` : ''}
                  </p>
                  {invite.expiresAt ? (
                    <p className="truncate text-[11px] text-white/45">
                      bis {new Date(invite.expiresAt).toLocaleString('de-AT')}
                    </p>
                  ) : null}
                  {invite.lastSentAt ? (
                    <p className="truncate text-[11px] text-white/40">
                      gesendet {new Date(invite.lastSentAt).toLocaleString('de-AT')}
                    </p>
                  ) : null}
                </div>
                {invite.state === 'open' ? (
                  <button
                    type="button"
                    disabled={inviteBusy}
                    onClick={() => void handleRevokeInvite(invite.id)}
                    className="shrink-0 text-[12px] text-red-300/90 disabled:opacity-50"
                  >
                    Widerrufen
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setLinkOpen(true)}
        className={`mt-3 w-full ${dsSecondaryCtaClass()} !min-h-[40px] !rounded-xl !text-[13px]`}
      >
        Bestehenden Account per E-Mail direkt verknüpfen
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
