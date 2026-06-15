import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../app/components/ui/Button';
import { useSession } from '../../auth/useSession';
import { isPlayerQrAccessEnabled } from '../../lib/playerAccessFeature';
import {
  mapPlayerLoginError,
  type PlayerCodeLoginResult,
} from '../../lib/playerLoginErrors';
import { INTRO_SPLASH_PATH } from '../../app/intro/introFlowSession';
import { supabase } from '../../lib/supabaseClient';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

type Props = {
  onBack: () => void;
};

export const PlayerLoginPanel: React.FC<Props> = ({ onBack }) => {
  const { setPreviewRole } = useSession();
  const [loginCode, setLoginCode] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const featureOn = isPlayerQrAccessEnabled();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!featureOn) {
      setError('Spieler-Login ist derzeit nicht aktiv.');
      return;
    }

    const code = loginCode.trim().toUpperCase();
    const pinValue = pin.trim();
    if (!code || pinValue.length < 4) {
      setError('Bitte Spieler-Code und PIN eingeben.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr) {
          setError(mapPlayerLoginError(anonErr.message));
          return;
        }
      }

      const { data, error: rpcError } = await supabase.rpc('player_code_login', {
        p_login_code: code,
        p_pin_plain: pinValue,
      });

      if (rpcError) {
        setError(mapPlayerLoginError(rpcError.message));
        return;
      }

      const row = (data ?? null) as PlayerCodeLoginResult | null;
      if (!row?.player_id || !row?.team_season_id) {
        setError('Anmeldung fehlgeschlagen (ungültige Server-Antwort).');
        return;
      }

      setPreviewRole('player');
      window.location.replace(INTRO_SPLASH_PATH);
    } catch (e: unknown) {
      setError(mapPlayerLoginError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  if (!featureOn) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Spieler-Login</h1>
        <p className="mt-3 text-sm text-white/65">
          Spieler-Login ist derzeit nicht freigeschaltet.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 text-sm text-white/60 hover:text-white/90 hover:underline"
        >
          Zurück zur Anmeldung
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
      <h1 className="text-xl font-semibold text-white">Spieler-Login</h1>
      <p className="mt-1 text-sm text-white/60">Spieler-Code und PIN — keine E-Mail nötig</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="player-login-code" className="mb-1 block text-sm font-medium text-white/80">
            Spieler-Code
          </label>
          <input
            id="player-login-code"
            type="text"
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
            placeholder="z. B. DANIEL19"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="player-login-pin" className="mb-1 block text-sm font-medium text-white/80">
            PIN
          </label>
          <div className="relative">
            <input
              id="player-login-pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              required
              autoComplete="off"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/50 hover:text-white/80"
              aria-label={showPin ? 'PIN verbergen' : 'PIN anzeigen'}
            >
              {showPin ? 'Verbergen' : 'Anzeigen'}
            </button>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" fullWidth disabled={loading} className="mt-2">
          {loading ? 'Wird angemeldet…' : 'Anmelden'}
        </Button>
      </form>

      <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
        <Link
          to="/app/player-access"
          className="text-sm text-white/60 hover:text-white/90 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded"
        >
          QR-Code scannen (erste Einrichtung)
        </Link>
        <button
          type="button"
          onClick={onBack}
          className="text-left text-sm text-white/60 hover:text-white/90 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded"
        >
          Zurück zur E-Mail-Anmeldung
        </button>
      </div>
    </div>
  );
};
