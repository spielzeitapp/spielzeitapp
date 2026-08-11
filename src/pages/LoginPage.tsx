import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { PlayerLoginPanel } from '../components/auth/PlayerLoginPanel';
import { isSafeAuthRedirectPath } from '../lib/authRedirect';
import { isPlayerQrAccessEnabled } from '../lib/playerAccessFeature';
import { setRememberMePreference, supabase } from '../lib/supabaseClient';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPlayerLogin, setShowPlayerLogin] = useState(false);

  const fromState = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const nextRaw = searchParams.get('next') ?? '';
  const nextSafe = isSafeAuthRedirectPath(nextRaw) ? nextRaw : null;
  const from = nextSafe || fromState || '/app/termine';
  const playerLoginEnabled = isPlayerQrAccessEnabled();

  useEffect(() => {
    const prefill = (searchParams.get('email') ?? '').trim();
    if (prefill) setEmail(prefill);
  }, [searchParams]);

  if (showPlayerLogin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
        <PlayerLoginPanel onBack={() => setShowPlayerLogin(false)} />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setRememberMePreference(rememberMe);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Anmelden</h1>
        <p className="mt-1 text-sm text-white/60">E-Mail und Passwort eingeben</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-white/80">
              E-Mail
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@beispiel.de"
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-white/80">
              Passwort
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/50 hover:text-white/80"
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPassword ? 'Verbergen' : 'Anzeigen'}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2.5 pt-0.5 text-sm text-white/75">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border border-white/25 bg-black/30 accent-red-500"
            />
            <span>Immer angemeldet bleiben</span>
          </label>

          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}

          <Button type="submit" fullWidth disabled={loading} className="mt-2">
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </Button>
        </form>

        {playerLoginEnabled ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setShowPlayerLogin(true)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Spieler-Login
            </button>
            <p className="mt-2 text-center text-[11px] text-white/50">
              Für Kinder ohne E-Mail — Code und PIN von den Eltern
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
          <Link
            to="/demo"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Demo ansehen
          </Link>
          <p className="text-center text-[11px] text-white/45">
            U12-Demoteam ohne Login — gleiche App-Oberfläche
          </p>
          <Link
            to="/forgot-password"
            className="text-sm text-white/60 hover:text-white/90 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded"
          >
            Passwort vergessen?
          </Link>
          <Link
            to="/register"
            className="text-sm text-white/60 hover:text-white/90 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded"
          >
            Noch kein Konto? Registrieren
          </Link>
        </div>
      </div>
    </div>
  );
};
