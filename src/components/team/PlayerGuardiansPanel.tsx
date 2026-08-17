import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import {
  fetchTeamPlayerParentLinks,
  parentPrimaryLabel,
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
  /** Invite-Formular beim Öffnen direkt anzeigen (z. B. leeres Profil). */
  defaultInviteOpen?: boolean;
};

function maskEmailForDisplay(email: string | null | undefined): string | null {
  const raw = (email ?? '').trim().toLowerCase();
  if (!raw || !raw.includes('@')) return null;
  const at = raw.indexOf('@');
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (!domain) return null;
  if (local.length <= 1) return `*@${domain}`;
  return `${local.slice(0, 1)}***@${domain}`;
}

function formatDeDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('de-AT');
}

export const PlayerGuardiansPanel: React.FC<PlayerGuardiansPanelProps> = ({
  teamSeasonId,
  playerId,
  playerName,
  parents: parentsProp,
  onChanged,
  onToast,
  className = '',
  defaultInviteOpen = false,
}) => {
  const [parents, setParents] = useState<ParentLinkInfo[]>(parentsProp ?? []);
  const [loading, setLoading] = useState(parentsProp == null);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [invites, setInvites] = useState<ParentInviteInfo[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteFormOpen, setInviteFormOpen] = useState(defaultInviteOpen);
  const [inviteEmail, setInviteEmail] = useState('');
  const [lastTypedEmail, setLastTypedEmail] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [freshExpiresAt, setFreshExpiresAt] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

  const openInvites = useMemo(
    () => invites.filter((i) => i.state === 'open'),
    [invites],
  );
  const historyInvites = useMemo(
    () => invites.filter((i) => i.state !== 'open').slice(0, 12),
    [invites],
  );
  const [menuParentId, setMenuParentId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (defaultInviteOpen) {
      setInviteFormOpen(true);
    }
  }, [defaultInviteOpen]);

  const toast = (msg: string) => {
    onToast?.(msg);
  };

  const resolveResendEmail = (invite: ParentInviteInfo): string | null => {
    if (!lastTypedEmail) return null;
    const maskedLast = maskEmailForDisplay(lastTypedEmail);
    if (
      invite.recipientEmailMasked &&
      maskedLast &&
      invite.recipientEmailMasked.toLowerCase() === maskedLast.toLowerCase()
    ) {
      return lastTypedEmail;
    }
    return null;
  };

  const handleSendEmailInvite = async (emailOverride?: string) => {
    if (inviteBusy) return;
    const email = (emailOverride ?? inviteEmail).trim().toLowerCase();
    if (!email || !email.includes('@') || email.length < 5) {
      setInviteError('Bitte eine gültige E-Mail-Adresse eingeben.');
      setInviteSuccess(null);
      return;
    }
    const alreadyLinked = parents.some(
      (parent) => (parent.email ?? '').trim().toLowerCase() === email,
    );
    if (alreadyLinked) {
      const msg =
        'Dieses Elternkonto ist bereits mit dem Spieler verknüpft. Es ist keine neue Einladung erforderlich.';
      setInviteError(msg);
      setInviteSuccess(null);
      toast(msg);
      return;
    }
    setInviteBusy(true);
    setInviteError(null);
    setInviteSuccess(null);
    setFreshToken(null);
    setFreshExpiresAt(null);

    const result = await sendParentEmailInvite({
      teamSeasonId,
      playerId,
      email,
    });
    setInviteBusy(false);

    if (!result.ok) {
      const msg = result.message ?? 'Einladung konnte nicht gesendet werden.';
      setInviteError(msg);
      toast(msg);
      return;
    }

    setLastTypedEmail(email);
    setInviteEmail(email);
    const masked = result.recipientEmailMasked ?? maskEmailForDisplay(email) ?? 'Eltern';
    if (result.emailSent) {
      const okMsg = `Einladung an ${masked} gesendet.`;
      setInviteSuccess(okMsg);
      toast(okMsg);
    } else {
      setFreshToken(result.codeFallback);
      setFreshExpiresAt(result.expiresAt);
      const fallbackMsg =
        result.message?.trim() ||
        (result.mailBlocker === 'smtp_send_failed' || result.mailBlocker === 'direct_mail_failed'
          ? 'Die Einladung wurde angelegt, aber der E-Mail-Versand ist fehlgeschlagen. Bitte später erneut versuchen oder den Code manuell weitergeben.'
          : 'E-Mail-Versand nicht möglich — Einladungscode als Fallback erstellt. Bitte manuell weitergeben.');
      setInviteError(fallbackMsg);
      setInviteSuccess(null);
      toast(fallbackMsg);
    }
    void loadInvites();
  };

  const handleResendInvite = async (invite: ParentInviteInfo) => {
    if (inviteBusy || invite.state !== 'open') return;
    const known = resolveResendEmail(invite);
    if (known) {
      await handleSendEmailInvite(known);
      return;
    }
    setInviteFormOpen(true);
    setInviteEmail('');
    setInviteError(
      invite.recipientEmailMasked
        ? `Bitte die E-Mail für ${invite.recipientEmailMasked} erneut eingeben, um die Einladung zu senden.`
        : 'Bitte die E-Mail-Adresse erneut eingeben, um die Einladung zu senden.',
    );
    setInviteSuccess(null);
  };

  const handleCreateCodeInvite = async () => {
    if (inviteBusy) return;
    setInviteBusy(true);
    setInviteError(null);
    setInviteSuccess(null);
    setFreshToken(null);
    setFreshExpiresAt(null);
    const result = await createParentLinkInvite({ teamSeasonId, playerId });
    setInviteBusy(false);
    if (result.status !== 'created' || !result.tokenPlain) {
      const msg = result.message ?? 'Einladungscode konnte nicht erstellt werden.';
      setInviteError(msg);
      toast(msg);
      return;
    }
    setFreshToken(result.tokenPlain);
    setFreshExpiresAt(result.expiresAt);
    const okMsg = `Einladungscode für ${playerName.trim() || 'Spieler'} erstellt.`;
    setInviteSuccess(okMsg);
    toast(okMsg);
    void loadInvites();
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (inviteBusy) return;
    setInviteBusy(true);
    setInviteError(null);
    const result = await revokeParentLinkInvite(inviteId);
    setInviteBusy(false);
    if (result.status !== 'revoked') {
      const msg = result.message ?? 'Widerruf fehlgeschlagen.';
      setInviteError(msg);
      toast(msg);
      return;
    }
    toast('Einladung widerrufen.');
    setInviteSuccess('Einladung widerrufen.');
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
          Eltern &amp; Verknüpfungen
        </h3>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-white/55">
        Persönliche Einladung über die bekannte Eltern-E-Mail — getrennt vom Spielerzugang.
      </p>

      {loading ? (
        <p className="mt-2 text-[13px] text-white/55">Lade Verknüpfungen…</p>
      ) : error ? (
        <p
          className="mt-2 rounded-lg border border-red-500/30 bg-red-950/30 px-2.5 py-2 text-[13px] text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : parents.length === 0 ? (
        <p className="mt-2 text-[13px] text-white/55">Noch kein Elternaccount verknüpft.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {parents.map((parent) => {
            const masked = maskEmailForDisplay(parent.email);
            const menuOpen = menuParentId === parent.user_id;
            return (
              <li
                key={parent.user_id}
                className="relative rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-white">
                      {parentPrimaryLabel(parent)}
                    </p>
                    {masked ? (
                      <p className="mt-0.5 truncate text-[12px] text-white/55">{masked}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200/90">
                      Verknüpft
                    </span>
                    <button
                      type="button"
                      aria-label="Aktionen"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuParentId(menuOpen ? null : parent.user_id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 hover:bg-white/10"
                    >
                      •••
                    </button>
                  </div>
                </div>
                {menuOpen ? (
                  <div className="mt-2 rounded-lg border border-white/10 bg-black/60 p-1">
                    <button
                      type="button"
                      disabled={busyUserId === parent.user_id}
                      onClick={() => {
                        setMenuParentId(null);
                        void handleUnlink(parent);
                      }}
                      className="w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold text-red-200 hover:bg-red-950/40 disabled:opacity-50"
                    >
                      {busyUserId === parent.user_id ? 'Entferne…' : 'Verknüpfung aufheben'}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {openInvites.length > 0 ? (
        <div className="mt-4">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-sky-300/85">
            Offene Einladungen
          </p>
          <ul className="mt-2 space-y-1.5">
            {openInvites.map((invite) => {
              const sentAt = formatDeDateTime(invite.lastSentAt ?? invite.emailedAt ?? invite.createdAt);
              const expiresAt = formatDeDateTime(invite.expiresAt);
              return (
                <li
                  key={invite.id}
                  className="rounded-lg border border-sky-500/20 bg-sky-950/20 px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white/90">
                        {parentInviteStateLabel(invite.state)}
                        {invite.channel === 'email' ? ' · E-Mail' : ' · Code'}
                        {invite.recipientEmailMasked ? ` · ${invite.recipientEmailMasked}` : ''}
                      </p>
                      {sentAt ? (
                        <p className="mt-0.5 text-[11px] text-white/45">Gesendet am {sentAt}</p>
                      ) : null}
                      {expiresAt ? (
                        <p className="text-[11px] text-white/45">Gültig bis {expiresAt}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {invite.channel === 'email' ? (
                        <button
                          type="button"
                          disabled={inviteBusy}
                          onClick={() => void handleResendInvite(invite)}
                          className="text-[12px] font-semibold text-red-300/95 disabled:opacity-50"
                        >
                          Erneut senden
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={inviteBusy}
                        onClick={() => void handleRevokeInvite(invite.id)}
                        className="text-[12px] text-white/55 disabled:opacity-50"
                      >
                        Widerrufen
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {historyInvites.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="text-[12px] font-semibold text-white/55 underline-offset-2 hover:text-white/75 hover:underline"
          >
            {historyOpen ? 'Verlauf ausblenden' : 'Verlauf anzeigen'}
          </button>
          {historyOpen ? (
            <ul className="mt-2 space-y-1.5">
              {historyInvites.map((invite) => {
                const sentAt = formatDeDateTime(
                  invite.lastSentAt ?? invite.emailedAt ?? invite.createdAt,
                );
                return (
                  <li
                    key={invite.id}
                    className="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2"
                  >
                    <p className="text-[12px] font-semibold text-white/80">
                      {parentInviteStateLabel(invite.state)}
                      {invite.recipientEmailMasked ? ` · ${invite.recipientEmailMasked}` : ''}
                    </p>
                    {sentAt ? (
                      <p className="mt-0.5 text-[11px] text-white/40">Versand: {sentAt}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
        {!inviteFormOpen ? (
          <button
            type="button"
            onClick={() => {
              setInviteFormOpen(true);
              setInviteError(null);
            }}
            className={`w-full ${dsPrimaryCtaClass()} !min-h-[44px] !rounded-xl !text-[14px]`}
          >
            Elternteil einladen
          </button>
        ) : (
          <>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-red-300/85">
              Elternteil einladen
            </p>
            <p className="mt-1 text-[12px] text-white/55">
              Die Einladung ist 72 Stunden gültig und nur mit dieser E-Mail-Adresse verwendbar.
            </p>

            <label
              className="mt-3 block text-[12px] text-white/70"
              htmlFor={`parent-invite-email-${playerId}`}
            >
              E-Mail-Adresse des Elternteils
            </label>
            <input
              id={`parent-invite-email-${playerId}`}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                if (inviteError) setInviteError(null);
                if (inviteSuccess) setInviteSuccess(null);
              }}
              placeholder="eltern@example.com"
              disabled={inviteBusy}
              className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-[14px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-60"
            />

            <button
              type="button"
              disabled={inviteBusy || !inviteEmail.trim()}
              onClick={() => void handleSendEmailInvite()}
              className={`mt-2.5 w-full ${dsPrimaryCtaClass()} !min-h-[44px] !rounded-xl !text-[14px] disabled:opacity-50`}
            >
              {inviteBusy ? 'Sende…' : 'Einladung senden'}
            </button>
            <span className="sr-only">Einladung per E-Mail senden</span>

            {inviteError ? (
              <p
                className="mt-2.5 rounded-lg border border-red-500/30 bg-red-950/35 px-2.5 py-2 text-[12px] text-red-100"
                role="alert"
              >
                {inviteError}
              </p>
            ) : null}
            {inviteSuccess ? (
              <p
                className="mt-2.5 rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-2.5 py-2 text-[12px] text-emerald-100/95"
                role="status"
              >
                {inviteSuccess}
              </p>
            ) : null}

            {freshToken ? (
              <div className="mt-2.5 rounded-lg border border-amber-500/25 bg-amber-950/20 px-2.5 py-2">
                <p className="text-[11px] text-amber-100/80">
                  Code-Fallback — nur jetzt sichtbar (WhatsApp / persönliche Übergabe):
                </p>
                <p className="mt-1 break-all font-mono text-[12px] text-amber-50">{freshToken}</p>
                {freshExpiresAt ? (
                  <p className="mt-1 text-[11px] text-white/50">
                    Gültig bis {formatDeDateTime(freshExpiresAt)}
                  </p>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              className="mt-2 text-[12px] text-white/50 underline-offset-2 hover:text-white/70 hover:underline"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              {advancedOpen ? 'Weniger Optionen' : 'Weitere Optionen'}
            </button>

            {advancedOpen ? (
              <div className="mt-2 space-y-2 border-t border-white/[0.06] pt-2">
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={() => void handleCreateCodeInvite()}
                  className={`w-full ${dsSecondaryCtaClass()} !min-h-[40px] !rounded-xl !py-2 !text-[13px] disabled:opacity-50`}
                >
                  {inviteBusy ? 'Erstelle…' : 'Einladungscode erstellen'}
                </button>
                <button
                  type="button"
                  onClick={() => setLinkOpen(true)}
                  className={`w-full ${dsSecondaryCtaClass()} !min-h-[40px] !rounded-xl !text-[13px]`}
                >
                  Bestehenden Account per E-Mail direkt verknüpfen
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

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
