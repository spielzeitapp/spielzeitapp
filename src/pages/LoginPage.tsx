import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { supabase } from '../lib/supabaseClient';

const PROD_URL = 'https://app.spielzeitapp.at';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/app/schedule';

  console.log('[LOGIN PAGE RENDER]');
  console.log('[LOGIN PAGE STATE]', { emailNotEmpty: !!email, loading, from });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage(null);
    setLoading(true);

    console.log('[AUTH MAGIC LINK START]', { email: email.trim() });
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${PROD_URL}/app`,
      },
    });
    setLoading(false);

    if (otpError) {
      console.log('[AUTH MAGIC LINK ERROR]', otpError);
      setError(otpError.message);
      return;
    }

    console.log('[AUTH MAGIC LINK SUCCESS]');
    setResetMessage({
      type: 'success',
      text: 'Wir haben dir einen Anmeldelink per E-Mail geschickt.',
    });
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
          Anmelden
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

          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
          {resetMessage && (
            <p className={`text-sm ${resetMessage.type === 'success' ? 'text-green-300' : 'text-red-300'}`} role="status">
              {resetMessage.text}
            </p>
          )}

          <Button type="submit" fullWidth disabled={loading} className="mt-2">
            {loading ? 'Sende Anmeldelink…' : 'Anmeldelink senden'}
          </Button>
        </form>

        {/* Optional: Passwort-Reset bleibt für Legacy-Accounts */}
        <p className="mt-4 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs text-white/40 hover:text-white/60 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:ring-offset-2 focus:ring-offset-transparent rounded"
          >
            Passwort vergessen? (Legacy)
          </button>
        </p>
      </div>
    </div>
  );
};
