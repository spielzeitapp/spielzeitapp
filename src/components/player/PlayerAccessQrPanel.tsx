import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabaseClient';
import { isPlayerQrAccessEnabled } from '../../lib/playerAccessFeature';
import {
  buildPlayerAccessFullUrl,
  mapPlayerAccessInviteError,
  type GenerateInviteRpcResult,
} from '../../lib/playerAccessInviteErrors';
import {
  mapPlayerLoginError,
  type GenerateLoginCredentialsResult,
  type LoginCredentialsStatus,
  type RotateLoginPinResult,
} from '../../lib/playerLoginErrors';

type Props = {
  playerId: string;
  playerName: string;
};

type ActiveInvite = {
  inviteId: string;
  fullUrl: string;
  expiresAt: string;
  qrDataUrl: string;
};

function formatExpiresAtDe(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('de-AT', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return iso;
  }
}

export const PlayerAccessQrPanel: React.FC<Props> = ({ playerId, playerName }) => {
  const featureOn = isPlayerQrAccessEnabled();
  const [active, setActive] = useState<ActiveInvite | null>(null);
  const [credentials, setCredentials] = useState<LoginCredentialsStatus | null>(null);
  const [visiblePin, setVisiblePin] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingCredentials, setGeneratingCredentials] = useState(false);
  const [rotatingPin, setRotatingPin] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const loadCredentialsStatus = useCallback(async () => {
    if (!featureOn) return;
    setLoadingStatus(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_player_login_credentials_status', {
        p_player_id: playerId,
      });
      if (rpcError) {
        setCredentials(null);
        return;
      }
      setCredentials((data ?? null) as LoginCredentialsStatus | null);
    } catch {
      setCredentials(null);
    } finally {
      setLoadingStatus(false);
    }
  }, [featureOn, playerId]);

  useEffect(() => {
    setActive(null);
    setVisiblePin(null);
    setError(null);
    setHint(null);
    void loadCredentialsStatus();
  }, [playerId, loadCredentialsStatus]);

  const generateQr = useCallback(async () => {
    if (!featureOn) {
      setError('Spieler-QR-Zugang ist derzeit nicht aktiv.');
      return;
    }
    setGenerating(true);
    setError(null);
    setHint(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('generate_player_access_invite', {
        p_player_id: playerId,
      });
      if (rpcError) {
        setError(mapPlayerAccessInviteError(rpcError.message));
        return;
      }
      const row = (data ?? null) as GenerateInviteRpcResult | null;
      if (!row?.invite_id || !row.token_plain || !row.url_path || !row.expires_at) {
        setError('Ungültige Server-Antwort beim Erstellen des Zugangs.');
        return;
      }
      const fullUrl = buildPlayerAccessFullUrl(row.url_path);
      const qrDataUrl = await QRCode.toDataURL(fullUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#0a0a0c', light: '#ffffff' },
      });
      setActive({
        inviteId: row.invite_id,
        fullUrl,
        expiresAt: row.expires_at,
        qrDataUrl,
      });
      setHint('QR-Code erstellt. Für die erste Einrichtung auf dem Gerät des Kindes scannen.');
    } catch (e: unknown) {
      setError(mapPlayerAccessInviteError(e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerating(false);
    }
  }, [featureOn, playerId]);

  const generateCredentials = useCallback(async () => {
    if (!featureOn) return;
    setGeneratingCredentials(true);
    setError(null);
    setHint(null);
    setVisiblePin(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('generate_player_login_credentials', {
        p_player_id: playerId,
      });
      if (rpcError) {
        setError(mapPlayerLoginError(rpcError.message));
        return;
      }
      const row = (data ?? null) as GenerateLoginCredentialsResult | null;
      if (!row?.login_code || !row?.pin_plain) {
        setError('Ungültige Server-Antwort beim Erstellen von Code und PIN.');
        return;
      }
      setVisiblePin(row.pin_plain);
      await loadCredentialsStatus();
      setHint('Code und PIN erstellt. PIN jetzt notieren — sie wird nur einmal angezeigt.');
    } catch (e: unknown) {
      setError(mapPlayerLoginError(e instanceof Error ? e.message : String(e)));
    } finally {
      setGeneratingCredentials(false);
    }
  }, [featureOn, loadCredentialsStatus, playerId]);

  const rotatePin = useCallback(async () => {
    if (!featureOn) return;
    setRotatingPin(true);
    setError(null);
    setHint(null);
    setVisiblePin(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('rotate_player_login_pin', {
        p_player_id: playerId,
      });
      if (rpcError) {
        setError(mapPlayerLoginError(rpcError.message));
        return;
      }
      const row = (data ?? null) as RotateLoginPinResult | null;
      if (!row?.pin_plain) {
        setError('Ungültige Server-Antwort beim Erstellen der neuen PIN.');
        return;
      }
      setVisiblePin(row.pin_plain);
      setHint('Neue PIN erstellt. Alte PIN ist ungültig.');
    } catch (e: unknown) {
      setError(mapPlayerLoginError(e instanceof Error ? e.message : String(e)));
    } finally {
      setRotatingPin(false);
    }
  }, [featureOn, playerId]);

  const revokeAccess = useCallback(async () => {
    if (!featureOn) return;
    setRevoking(true);
    setError(null);
    setHint(null);
    try {
      const { error: rpcError } = await supabase.rpc('revoke_player_login', {
        p_player_id: playerId,
      });
      if (rpcError) {
        setError(mapPlayerLoginError(rpcError.message));
        return;
      }
      setActive(null);
      setVisiblePin(null);
      setCredentials({ has_credentials: true, active: false, login_code: null });
      setHint('Spielerzugang gesperrt (QR, Code und PIN).');
    } catch (e: unknown) {
      setError(mapPlayerLoginError(e instanceof Error ? e.message : String(e)));
    } finally {
      setRevoking(false);
    }
  }, [featureOn, playerId]);

  const copyText = useCallback(async (text: string, successHint: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setHint(successHint);
      window.setTimeout(() => setHint(null), 2400);
    } catch {
      setError('Kopieren nicht möglich.');
    }
  }, []);

  const copyLink = useCallback(async () => {
    if (!active?.fullUrl) return;
    await copyText(active.fullUrl, 'Link kopiert.');
  }, [active?.fullUrl, copyText]);

  const shareLink = useCallback(async () => {
    if (!active?.fullUrl || typeof navigator.share !== 'function') return;
    try {
      await navigator.share({
        title: `Spielerzugang · ${playerName}`,
        text: `Spieleransicht für ${playerName} in der SpielzeitApp öffnen.`,
        url: active.fullUrl,
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError('Teilen nicht möglich.');
    }
  }, [active?.fullUrl, playerName]);

  if (!featureOn) {
    return null;
  }

  const accessActive = credentials?.active === true;
  const loginCode = credentials?.login_code ?? null;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
      <p className="text-[13px] font-semibold text-white">Spielerzugang</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/65">
        QR-Code für die erste Einrichtung. Code + PIN für spätere Anmeldung, falls die App gelöscht wurde.
      </p>
      <p className="mt-1.5 text-[10px] leading-relaxed text-white/50">
        Termine, Team, Feed und Liveticker sichtbar. Zu-/Absagen bleiben bei den Eltern.
      </p>

      {error ? (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
          {error}
        </p>
      ) : null}

      {hint ? <p className="mt-2 text-[11px] text-emerald-300/90">{hint}</p> : null}

      <div className="mt-3 space-y-3">
        {loadingStatus ? (
          <p className="text-[11px] text-white/50">Lade Zugangsstatus…</p>
        ) : accessActive && loginCode ? (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-200/80">
              Spielerzugang aktiv
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] text-white/50">Spieler-Code</p>
                <p className="font-mono text-[15px] font-semibold tracking-wider text-white">{loginCode}</p>
              </div>
              <button
                type="button"
                onClick={() => void copyText(loginCode, 'Spieler-Code kopiert.')}
                className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white hover:bg-white/10"
              >
                Kopieren
              </button>
            </div>
            {visiblePin ? (
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                <div>
                  <p className="text-[10px] text-white/50">PIN (nur jetzt sichtbar)</p>
                  <p className="font-mono text-[15px] font-semibold tracking-widest text-amber-100">{visiblePin}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyText(`${loginCode}\n${visiblePin}`, 'Code und PIN kopiert.')}
                  className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white hover:bg-white/10"
                >
                  Code + PIN
                </button>
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-white/45">
                PIN wird nur nach Erstellung oder „PIN neu generieren“ angezeigt.
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-white/55">
            Noch kein Spieler-Code aktiv. Erstelle Code + PIN oder einen QR-Code.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={generatingCredentials}
            onClick={() => void generateCredentials()}
            className="rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[12px] font-medium text-white hover:bg-white/10 disabled:opacity-60"
          >
            {generatingCredentials ? '…' : accessActive ? 'Code neu erstellen' : 'Code + PIN erstellen'}
          </button>
          <button
            type="button"
            disabled={rotatingPin || !accessActive}
            onClick={() => void rotatePin()}
            className="rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[12px] font-medium text-white hover:bg-white/10 disabled:opacity-60"
          >
            {rotatingPin ? '…' : 'PIN neu generieren'}
          </button>
        </div>

        {!active ? (
          <button
            type="button"
            disabled={generating}
            onClick={() => void generateQr()}
            className="w-full rounded-xl border border-red-500/35 bg-red-500/15 px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-500/25 disabled:opacity-60"
          >
            {generating ? 'Wird erstellt…' : 'QR-Code anzeigen / erstellen'}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center rounded-xl bg-white p-3">
              <img
                src={active.qrDataUrl}
                alt={`QR-Code Spielerzugang für ${playerName}`}
                className="h-[min(280px,70vw)] w-[min(280px,70vw)] max-w-full"
              />
            </div>

            <p className="text-center text-[10px] text-white/50">
              Gültig bis {formatExpiresAtDe(active.expiresAt)}
            </p>

            <p className="break-all rounded-lg border border-white/8 bg-white/5 px-2 py-1.5 text-[10px] text-white/55">
              {active.fullUrl}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[12px] font-medium text-white hover:bg-white/10"
              >
                Link kopieren
              </button>
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                <button
                  type="button"
                  onClick={() => void shareLink()}
                  className="rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[12px] font-medium text-white hover:bg-white/10"
                >
                  Teilen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void generateQr()}
                  disabled={generating}
                  className="rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[12px] font-medium text-white hover:bg-white/10 disabled:opacity-60"
                >
                  Neu erstellen
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => void generateQr()}
              disabled={generating}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[12px] font-medium text-white hover:bg-white/10 disabled:opacity-60"
            >
              {generating ? '…' : 'QR-Code neu erstellen'}
            </button>
          </div>
        )}

        {(accessActive || active) ? (
          <button
            type="button"
            onClick={() => void revokeAccess()}
            disabled={revoking}
            className="w-full rounded-xl border border-red-500/35 bg-red-500/10 px-2 py-2.5 text-[12px] font-medium text-red-200 hover:bg-red-500/20 disabled:opacity-60"
          >
            {revoking ? '…' : 'Zugang sperren'}
          </button>
        ) : null}
      </div>
    </div>
  );
};
