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
  const [showMagicLinkSection, setShowMagicLinkSection] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = magicLinkEmail.trim();
    if (!trimmed) return;
    setMagicLinkMessage(null);
    setMagicLinkLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${PROD_URL}/app` },
    });
    setMagicLinkLoading(false);
    if (otpError) {
      setMagicLinkMessage({ type: 'error', text: otpError.message });
      return;
    }
    setMagicLinkMessage({ type: 'success', text: 'Anmeldelink wurde gesendet. Bitte Postfach prüfen.' });
  };

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Anmelden</h1>
        <p className="mt-1 text-sm text-white/60">E-Mail und Passwort eingeben</p>

        {/* Primary: E-Mail + Passwort – kein Magic Link, nur expliziter Submit */}
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

        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
          <Link
            to="/forgot-password"
            className="text-sm text-white/60 hover:text-white/90 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded"
          >
            Passwort vergessen?
          </Link>
          <button
            type="button"
            onClick={() => {
              setShowMagicLinkSection((v) => !v);
              setMagicLinkMessage(null);
            }}
            className="text-left text-sm text-white/60 hover:text-white/90 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded"
          >
            {showMagicLinkSection ? 'Anmeldelink ausblenden' : 'Mit Anmeldelink anmelden'}
          </button>
          <Link
            to="/register"
            className="text-sm text-white/60 hover:text-white/90 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded"
          >
            Erstzugang / Registrierung
          </Link>
        </div>

        {showMagicLinkSection && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/60 mb-3">
              Nur wenn du explizit einen Link möchtest: E-Mail eingeben und „Link senden“ tippen. Es wird kein Link automatisch verschickt.
            </p>
            <form onSubmit={handleSendMagicLink} className="space-y-3">
              <input
                type="email"
                value={magicLinkEmail}
                onChange={(e) => setMagicLinkEmail(e.target.value)}
                placeholder="E-Mail für Anmeldelink"
                className={inputClass}
                autoComplete="email"
              />
              {magicLinkMessage && (
                <p className={`text-sm ${magicLinkMessage.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                  {magicLinkMessage.text}
                </p>
              )}
              <Button type="submit" fullWidth disabled={magicLinkLoading || !magicLinkEmail.trim()} variant="secondary">
                {magicLinkLoading ? 'Wird gesendet…' : 'Anmeldelink senden'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
