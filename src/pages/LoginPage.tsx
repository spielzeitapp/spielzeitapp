import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { supabase } from '../lib/supabaseClient';

const PROD_URL = 'https://app.spielzeitapp.at';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/app/schedule';

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage(null);
    setLoading(true);
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

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage(null);
    setLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${PROD_URL}/app` },
    });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setMessage({ type: 'success', text: 'Wir haben dir einen Anmeldelink per E-Mail geschickt.' });
  };

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Anmelden</h1>
        {import.meta.env.DEV && (
          <p className="mt-0.5 text-xs text-white/50">DEV Login (Eltern/Fan)</p>
        )}

        {/* E-Mail + Passwort: für wiederkehrende Nutzer (z. B. Eltern mit gesetztem Passwort) */}
        <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
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

          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`} role="status">
              {message.text}
            </p>
          )}

          <Button type="submit" fullWidth disabled={loading} className="mt-2">
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </Button>
        </form>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-xs text-white/60 mb-2">Erstes Mal oder kein Passwort?</p>
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={loading || !email.trim()}
            className="text-sm text-white/80 hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded disabled:opacity-50"
          >
            Anmeldelink per E-Mail senden
          </button>
        </div>

        <p className="mt-4 text-center">
          <Link
            to="/forgot-password"
            className="text-xs text-white/40 hover:text-white/60 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded"
          >
            Passwort vergessen?
          </Link>
        </p>

        <p className="mt-4 text-center text-sm text-white/60">
          Noch kein Konto?{' '}
          <Link to="/register" className="text-white/80 hover:text-white hover:underline">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
};
