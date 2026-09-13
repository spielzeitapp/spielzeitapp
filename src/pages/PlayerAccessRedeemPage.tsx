import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import {
  isTurnstileConfigured,
  TurnstileWidget,
} from '../components/auth/TurnstileWidget';
import { setRememberMePreference, supabase } from '../lib/supabaseClient';
import { useSession } from '../auth/useSession';
import { isPlayerQrAccessEnabled } from '../lib/playerAccessFeature';
import { mapPlayerAccessRedeemError } from '../lib/playerAccessRedeemErrors';
import { INTRO_SPLASH_PATH } from '../app/intro/introFlowSession';

type RedeemPhase = 'idle' | 'working' | 'success' | 'error';

type RedeemRpcResult = {
  player_id: string;
  team_season_id: string;
  access_mode?: string;
};

export const PlayerAccessRedeemPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setPreviewRole } = useSession();
  const token = (searchParams.get('t') ?? '').trim();

  const [phase, setPhase] = useState<RedeemPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [rememberMe, setRememberMe] = useState(true);

  const handleRedeem = async () => {
    if (!token) {
      setPhase('error');
      setErrorMessage('Kein Zugangscode in der URL. Bitte den QR-Code erneut scannen.');
      return;
    }

    setPhase('working');
    setErrorMessage(null);
    setRememberMePreference(rememberMe);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously({
          options: captchaToken ? { captchaToken } : undefined,
        });
        if (anonErr) {
          setPhase('error');
          setErrorMessage(mapPlayerAccessRedeemError(anonErr.message));
          return;
        }
      }

      const { data, error } = await supabase.rpc('redeem_player_access_invite', {
        p_token: token,
      });

      if (error) {
        setPhase('error');
        setErrorMessage(mapPlayerAccessRedeemError(error.message));
        return;
      }

      const row = (data ?? null) as RedeemRpcResult | null;
      if (!row?.player_id || !row?.team_season_id) {
        setPhase('error');
        setErrorMessage('Einlösung fehlgeschlagen (ungültige Server-Antwort).');
        return;
      }

      setPreviewRole('player');
      setPhase('success');
      window.location.replace(INTRO_SPLASH_PATH);
    } catch (e: unknown) {
      setPhase('error');
      setErrorMessage(mapPlayerAccessRedeemError(e instanceof Error ? e.message : String(e)));
    } finally {
      setCaptchaToken(null);
      setCaptchaResetKey((value) => value + 1);
    }
  };

  if (!isPlayerQrAccessEnabled()) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-white">Spieler-QR-Zugang ist derzeit nicht aktiv.</p>
        <p className="mt-2 max-w-sm text-sm text-white/65">
          Diese Funktion ist noch nicht freigeschaltet (Feature-Flag).
        </p>
        <button
          type="button"
          className="mt-6 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white"
          onClick={() => navigate('/login', { replace: true })}
        >
          Zur Anmeldung
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      {phase === 'working' ? (
        <>
          <p className="text-lg font-semibold text-white">Spielerzugang wird eingerichtet…</p>
          <p className="mt-2 text-sm text-white/60">Bitte einen Moment warten.</p>
        </>
      ) : null}

      {phase === 'idle' ? (
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-5 text-left shadow-xl">
          <h1 className="text-xl font-semibold text-white">Spielerzugang einrichten</h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Sicherheitsprüfung bestätigen und anschließend den neuen Zugang aktivieren.
          </p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-2.5">
            <p className="mb-2 px-1 text-xs font-semibold text-white/50">Sichere Anmeldung</p>
            <TurnstileWidget onTokenChange={setCaptchaToken} resetKey={captchaResetKey} />
          </div>
          <label className="mt-4 flex items-center gap-2.5 text-sm text-white/70">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 shrink-0 rounded border border-white/25 bg-black/30 accent-red-500"
            />
            <span>Auf diesem Gerät angemeldet bleiben</span>
          </label>
          <Button
            type="button"
            fullWidth
            disabled={isTurnstileConfigured && !captchaToken}
            className="mt-4"
            onClick={() => void handleRedeem()}
          >
            Spielerzugang aktivieren
          </Button>
        </div>
      ) : null}

      {phase === 'success' ? (
        <>
          <p className="text-lg font-semibold text-white">Willkommen!</p>
          <p className="mt-2 text-sm text-white/60">Weiterleitung zur Willkommensseite…</p>
        </>
      ) : null}

      {phase === 'error' ? (
        <>
          <p className="text-lg font-semibold text-red-200">Zugang nicht möglich</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">{errorMessage}</p>
          <button
            type="button"
            className="mt-6 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white"
            onClick={() => {
              setErrorMessage(null);
              setPhase('idle');
            }}
          >
            Erneut versuchen
          </button>
          <button
            type="button"
            className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white"
            onClick={() => navigate('/login', { replace: true })}
          >
            Zur Anmeldung
          </button>
        </>
      ) : null}
    </div>
  );
};
