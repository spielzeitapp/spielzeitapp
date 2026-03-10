import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../app/components/ui/Button';
import { supabase } from '../lib/supabaseClient';

const PROD_URL = 'https://app.spielzeitapp.at';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

export const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/app/schedule';

  console.log('[LOGIN PAGE RENDER]');
  console.log('[LOGIN PAGE STATE]', { mode, emailNotEmpty: !!email, loading });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage(null);
    setLoading(true);

    if (mode === 'signup') {
      console.log('[AUTH SIGNUP START]', { email: email.trim() });
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${PROD_URL}/`,
        },
      });
      setLoading(false);
      if (signUpError) {
        console.log('[AUTH SIGNUP ERROR]', signUpError);
        setError(signUpError.message);
        return;
      }
      console.log('[AUTH SIGNUP SUCCESS]', { user: data.user, session: data.session });

      // Falls Supabase direkt eine Session zurückgibt: sofort weiter.
      if (data.session) {
        console.log('[AUTH LOGIN SUCCESS]');
        navigate(from, { replace: true });
        return;
      }

      // Sonst: klare Erfolgsmeldung und Hinweis zum Einloggen.
      setResetMessage({
        type: 'success',
        text: 'Konto erstellt. Bitte jetzt einloggen.',
      });
      setMode('login');
      return;
    }

    console.log('[AUTH LOGIN START]', { email: email.trim() });
    const { error: signInError } = await signIn(email, password);
    setLoading(false);

    if (signInError) {
      console.log('[AUTH LOGIN ERROR]', signInError);
      setError(signInError.message);
    } else {
      console.log('[AUTH LOGIN SUCCESS]');
      navigate(from, { replace: true });
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    setResetMessage(null);
    if (!email.trim()) {
      setResetMessage({ type: 'error', text: 'Bitte zuerst E-Mail eingeben.' });
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${PROD_URL}/`,
    });
    if (resetError) {
      setResetMessage({ type: 'error', text: resetError.message });
    } else {
      setResetMessage({ type: 'success', text: 'E-Mail zum Zurücksetzen gesendet. Bitte Postfach prüfen.' });
    }
  };

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">
          {mode === 'signup' ? 'Registrieren' : 'Einloggen'}
        </h1>
        <p className="mt-1 text-xs text-white/60">LOGIN PAGE LOADED</p>
        {import.meta.env.DEV && (
          <p className="mt-0.5 text-xs text-white/50">DEV Login</p>
        )}

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
                placeholder="Passwort"
                required
                autoComplete="current-password"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/50 hover:text-white/80 focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:ring-offset-2 focus:ring-offset-transparent rounded px-1"
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPassword ? 'Verbergen' : 'Anzeigen'}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
          {resetMessage && (
            <p className={`text-sm ${resetMessage.type === 'success' ? 'text-green-300' : 'text-red-300'}`} role="status">
              {resetMessage.text}
            </p>
          )}

          <Button type="submit" fullWidth disabled={loading} className="mt-2">
            {mode === 'signup'
              ? (loading ? 'Konto wird erstellt…' : 'Konto erstellen')
              : (loading ? 'Wird angemeldet…' : 'Einloggen')}
          </Button>
        </form>

        <p className="mt-4 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm text-white/60 hover:text-white/80 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:ring-offset-2 focus:ring-offset-transparent rounded"
          >
            Passwort vergessen?
          </button>
        </p>

        <p className="mt-2 text-center">
          <button
            type="button"
            onClick={() => {
              setError('');
              setResetMessage(null);
              setMode((m) => (m === 'login' ? 'signup' : 'login'));
            }}
            className="text-sm text-white/60 hover:text-white/80 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:ring-offset-2 focus:ring-offset-transparent rounded"
          >
            {mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Einloggen'}
          </button>
        </p>
      </div>
    </div>
  );
};
