import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import { AUTH_PASSWORD_RECOVERY_PATH, getAuthRedirectUrl } from '../lib/authRedirect';
import { AUTH_PAGE_CARD_CLASS, AUTH_PAGE_SHELL_CLASS } from '../app/layout/authPageShell';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

/**
 * Dedicated page for "Forgot password": enter email, Supabase sends reset link.
 * Link leads to /app/set-password where user sets the new password.
 */
export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setMessage({ type: 'error', text: 'Bitte E-Mail eingeben.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: getAuthRedirectUrl(AUTH_PASSWORD_RECOVERY_PATH),
    });
    setLoading(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({
      type: 'success',
      text: 'E-Mail zum Zurücksetzen gesendet. Bitte Postfach prüfen und den Link öffnen – dort kannst du ein neues Passwort festlegen.',
    });
  };

  return (
    <div className={AUTH_PAGE_SHELL_CLASS}>
      <div className={AUTH_PAGE_CARD_CLASS}>
        <h1 className="text-xl font-semibold text-white">Passwort zurücksetzen</h1>
        <p className="mt-1 text-sm text-white/60">
          E-Mail eingeben – wir schicken dir einen Link zum Festlegen eines neuen Passworts.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="forgot-email" className="mb-1 block text-sm font-medium text-white/80">
              E-Mail
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@beispiel.de"
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>
          {message && (
            <p
              className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}
              role="status"
            >
              {message.text}
            </p>
          )}
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Wird gesendet…' : 'Link senden'}
          </Button>
        </form>

        <p className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-white/60">
          <Link to="/login" className="text-white/80 hover:text-white hover:underline">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </div>
  );
};
