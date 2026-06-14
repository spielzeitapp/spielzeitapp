import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSession } from '../auth/useSession';
import { isPlayerQrAccessEnabled } from '../lib/playerAccessFeature';
import { mapPlayerAccessRedeemError } from '../lib/playerAccessRedeemErrors';
import { INTRO_WELCOME_PATH } from '../app/intro/introFlowSession';

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
  const startedRef = useRef(false);

  const [phase, setPhase] = useState<RedeemPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isPlayerQrAccessEnabled()) return;
    if (!token) {
      setPhase('error');
      setErrorMessage('Kein Zugangscode in der URL. Bitte den QR-Code erneut scannen.');
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let alive = true;

    async function run() {
      setPhase('working');
      setErrorMessage(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          const { error: anonErr } = await supabase.auth.signInAnonymously();
          if (anonErr) {
            if (!alive) return;
            setPhase('error');
            setErrorMessage(mapPlayerAccessRedeemError(anonErr.message));
            return;
          }
        }

        const { data, error } = await supabase.rpc('redeem_player_access_invite', {
          p_token: token,
        });

        if (!alive) return;

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
        window.location.replace(INTRO_WELCOME_PATH);
      } catch (e: unknown) {
        if (!alive) return;
        setPhase('error');
        setErrorMessage(mapPlayerAccessRedeemError(e instanceof Error ? e.message : String(e)));
      }
    }

    void run();

    return () => {
      alive = false;
    };
  }, [token, setPreviewRole, navigate]);

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
      {phase === 'working' || phase === 'idle' ? (
        <>
          <p className="text-lg font-semibold text-white">Spielerzugang wird eingerichtet…</p>
          <p className="mt-2 text-sm text-white/60">Bitte einen Moment warten.</p>
        </>
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
            className="mt-6 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white"
            onClick={() => navigate('/login', { replace: true })}
          >
            Zur Anmeldung
          </button>
        </>
      ) : null}
    </div>
  );
};
