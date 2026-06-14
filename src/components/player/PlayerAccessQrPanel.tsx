import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabaseClient';
import { isPlayerQrAccessEnabled } from '../../lib/playerAccessFeature';
import {
  buildPlayerAccessFullUrl,
  mapPlayerAccessInviteError,
  type GenerateInviteRpcResult,
} from '../../lib/playerAccessInviteErrors';

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
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setActive(null);
    setError(null);
    setHint(null);
  }, [playerId]);

  const generate = useCallback(async () => {
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
    } catch (e: unknown) {
      setError(mapPlayerAccessInviteError(e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerating(false);
    }
  }, [featureOn, playerId]);

  const revoke = useCallback(async () => {
    if (!active?.inviteId) return;
    setRevoking(true);
    setError(null);
    setHint(null);
    try {
      const { error: rpcError } = await supabase.rpc('revoke_player_access_invite', {
        p_invite_id: active.inviteId,
      });
      if (rpcError) {
        setError(mapPlayerAccessInviteError(rpcError.message));
        return;
      }
      setActive(null);
      setHint('Spielerzugang wurde widerrufen.');
    } catch (e: unknown) {
      setError(mapPlayerAccessInviteError(e instanceof Error ? e.message : String(e)));
    } finally {
      setRevoking(false);
    }
  }, [active?.inviteId]);

  const copyLink = useCallback(async () => {
    if (!active?.fullUrl) return;
    try {
      await navigator.clipboard.writeText(active.fullUrl);
      setHint('Link kopiert.');
      window.setTimeout(() => setHint(null), 2400);
    } catch {
      setError('Link konnte nicht kopiert werden.');
    }
  }, [active?.fullUrl]);

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

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
      <p className="text-[13px] font-semibold text-white">Spielerzugang</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/65">
        Dein Kind kann mit diesem QR-Code die Spieleransicht öffnen.
      </p>
      <p className="mt-1.5 text-[10px] leading-relaxed text-white/50">
        Der Spielerzugang zeigt Termine, Team, Feed und Liveticker. Zu-/Absagen bleiben bei den Eltern.
      </p>

      {error ? (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
          {error}
        </p>
      ) : null}

      {hint ? <p className="mt-2 text-[11px] text-emerald-300/90">{hint}</p> : null}

      {!active ? (
        <button
          type="button"
          disabled={generating}
          onClick={() => void generate()}
          className="mt-3 w-full rounded-xl border border-red-500/35 bg-red-500/15 px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-500/25 disabled:opacity-60"
        >
          {generating ? 'Wird erstellt…' : 'Spielerzugang erstellen'}
        </button>
      ) : (
        <div className="mt-3 space-y-3">
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
          <p className="text-center text-[10px] leading-relaxed text-amber-200/80">
            Nur für Spieleransicht. Keine Zu-/Absage möglich.
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
                onClick={() => void generate()}
                disabled={generating}
                className="rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[12px] font-medium text-white hover:bg-white/10 disabled:opacity-60"
              >
                Neu erstellen
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={generating}
              className="rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-[12px] font-medium text-white hover:bg-white/10 disabled:opacity-60"
            >
              {generating ? '…' : 'Neu erstellen'}
            </button>
            <button
              type="button"
              onClick={() => void revoke()}
              disabled={revoking}
              className="rounded-xl border border-red-500/35 bg-red-500/10 px-2 py-2 text-[12px] font-medium text-red-200 hover:bg-red-500/20 disabled:opacity-60"
            >
              {revoking ? '…' : 'Zugang widerrufen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
