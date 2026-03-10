import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import { PENDING_PROFILE_KEY, type PendingProfile } from '../lib/pendingProfile';

const PROD_URL = 'https://app.spielzeitapp.at';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

export const RegisterPage: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      setMessage({ type: 'error', text: 'Bitte Vorname, Nachname und E-Mail ausfüllen.' });
      return;
    }

    setLoading(true);

    try {
      const payload: PendingProfile = {
        email: trimmedEmail,
        first_name: trimmedFirst,
        last_name: trimmedLast,
      };
      localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(payload));

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { emailRedirectTo: `${PROD_URL}/app` },
      });

      if (otpError) {
        setError(otpError.message);
        setMessage({ type: 'error', text: otpError.message });
        setLoading(false);
        return;
      }

      setMessage({
        type: 'success',
        text: 'Wir haben dir einen Anmeldelink per E-Mail geschickt. Nach dem Klick meldest du dich an und kannst Kind verknüpfen und ein Passwort setzen.',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Registrierung fehlgeschlagen.';
      setError(msg);
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Registrieren</h1>
        <p className="mt-1 text-sm text-white/60">
          Für Eltern: Nach dem ersten Anmelden verknüpfst du dein Kind und setzt ein Passwort.
        </p>

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reg-first-name" className="mb-1 block text-sm font-medium text-white/80">
              Vorname
            </label>
            <input
              id="reg-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Max"
              required
              autoComplete="given-name"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="reg-last-name" className="mb-1 block text-sm font-medium text-white/80">
              Nachname
            </label>
            <input
              id="reg-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Mustermann"
              required
              autoComplete="family-name"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="reg-email" className="mb-1 block text-sm font-medium text-white/80">
              E-Mail
            </label>
            <input
              id="reg-email"
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
          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`} role="status">
              {message.text}
            </p>
          )}

          <Button type="submit" fullWidth disabled={loading} className="mt-2">
            {loading ? 'Wird gesendet…' : 'Anmeldelink senden'}
          </Button>
        </form>

        <p className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-white/60">
          Bereits registriert?{' '}
          <Link to="/login" className="text-white/80 hover:text-white hover:underline">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
};
