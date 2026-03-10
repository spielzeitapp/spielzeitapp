import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { supabase } from '../lib/supabaseClient';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

const MIN_PASSWORD_LENGTH = 6;

/** Redirect URL after user clicks confirmation link in email (must be in Supabase Redirect URLs allow list). */
const EMAIL_REDIRECT_TO = 'https://app.spielzeitapp.at/app';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage(null);
    setNeedsEmailConfirmation(false);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      setMessage({ type: 'error', text: 'Bitte Vorname, Nachname und E-Mail ausfüllen.' });
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage({ type: 'error', text: `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.` });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwörter stimmen nicht überein.' });
      return;
    }

    setLoading(true);

    try {
      const signUpPayload = {
        email: trimmedEmail,
        password,
        options: {
          data: { first_name: trimmedFirst, last_name: trimmedLast },
          emailRedirectTo: EMAIL_REDIRECT_TO,
        },
      };
      console.log('[RegisterPage] signUp payload (no password):', {
        email: signUpPayload.email,
        options: signUpPayload.options,
      });

      const result = await supabase.auth.signUp(signUpPayload);
      const { data, error: signUpError } = result;

      console.log('[RegisterPage] signUp result:', {
        hasData: !!data,
        hasError: !!signUpError,
        errorMessage: signUpError?.message ?? null,
        errorCode: (signUpError as { code?: string } | null)?.code ?? null,
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        userIdentitiesLength: data?.user?.identities?.length ?? 0,
        userEmailConfirmed: data?.user?.email_confirmed_at ?? null,
        userId: data?.user?.id ?? null,
      });

      if (signUpError) {
        setError(signUpError.message);
        setMessage({ type: 'error', text: signUpError.message });
        setLoading(false);
        return;
      }

      if (data.session) {
        setLoading(false);
        navigate('/app', { replace: true });
        return;
      }

      if (data?.user?.identities?.length === 0) {
        console.warn('[RegisterPage] signUp returned user with identities.length === 0 (email may already be registered). No confirmation email is sent in that case.');
      }
      setNeedsEmailConfirmation(true);
      setMessage({
        type: 'success',
        text: 'Konto angelegt. Bitte E-Mail bestätigen – du erhältst einen Link zur Bestätigung.',
      });
    } catch (e) {
      console.error('[RegisterPage] signUp exception:', e);
      const msg = e instanceof Error ? e.message : 'Registrierung fehlgeschlagen.';
      setError(msg);
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  if (needsEmailConfirmation) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
          <h1 className="text-xl font-semibold text-white">E-Mail bestätigen</h1>
          <p className="mt-2 text-sm text-white/70">
            Wir haben dir eine E-Mail geschickt. Bitte klicke auf den Link darin, um dein Konto zu aktivieren. Danach kannst du dich mit E-Mail und Passwort anmelden.
          </p>
          <p className="mt-4 text-center text-sm text-white/60">
            <Link to="/login" className="text-white/80 hover:text-white hover:underline">
              Zur Anmeldung
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Registrieren</h1>
        <p className="mt-1 text-sm text-white/60">
          Konto anlegen – danach kannst du Rolle, Team und Kind verknüpfen.
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
          <div>
            <label htmlFor="reg-password" className="mb-1 block text-sm font-medium text-white/80">
              Passwort
            </label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
              minLength={MIN_PASSWORD_LENGTH}
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="reg-confirm-password" className="mb-1 block text-sm font-medium text-white/80">
              Passwort wiederholen
            </label>
            <input
              id="reg-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
              minLength={MIN_PASSWORD_LENGTH}
              required
              autoComplete="new-password"
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
            {loading ? 'Wird angelegt…' : 'Konto anlegen'}
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
