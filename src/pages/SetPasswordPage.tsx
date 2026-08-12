import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { Card, CardTitle } from '../app/components/ui/Card';
import { supabase } from '../lib/supabaseClient';
import {
  clearEmailConfirmFlow,
  clearPasswordRecoveryFlow,
  isEmailConfirmFlow,
  isPasswordRecoveryFlow,
} from '../lib/authRedirect';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

/**
 * Nur für echte Passwort-Recovery („Passwort vergessen“).
 * Normale Signup-E-Mail-Bestätigung darf hier nicht landen.
 */
export const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const submitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    async function gate() {
      // Kurz warten, damit Auth-Callback / PASSWORD_RECOVERY-Flag gesetzt sein kann
      await new Promise((r) => window.setTimeout(r, 50));
      if (!alive) return;

      if (isPasswordRecoveryFlow()) {
        setAllowed(true);
        setChecking(false);
        return;
      }

      if (isEmailConfirmFlow()) {
        clearEmailConfirmFlow();
        navigate('/app', { replace: true });
        return;
      }

      // Kein Recovery-Kontext → nicht als Passwort-Setzen missbrauchen
      navigate('/app', { replace: true });
    }

    void gate();
    return () => {
      alive = false;
    };
  }, [navigate]);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA')) return;
      window.setTimeout(() => {
        try {
          t.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {
          /* ignore */
        }
      }, 150);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen haben.');
      return;
    }
    if (password !== confirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      submitRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    clearPasswordRecoveryFlow();
    setSuccess(true);
    setTimeout(() => navigate('/app', { replace: true }), 800);
  };

  if (checking || !allowed) {
    return (
      <div className="py-2">
        <Card>
          <CardTitle>Weiterleitung…</CardTitle>
          <p className="mt-1 text-sm text-[var(--text-sub)]">Einen Moment bitte.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-2">
      <Card>
        <CardTitle>Passwort festlegen</CardTitle>
        <p className="mt-1 text-sm text-[var(--text-sub)]">
          Lege ein neues Passwort für die Anmeldung fest. Danach kannst du dich mit E-Mail und
          Passwort einloggen.
        </p>
        {success ? (
          <p className="mt-4 text-sm text-green-400">Passwort gespeichert. Du wirst weitergeleitet…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 pb-6">
            <div>
              <label htmlFor="set-password" className="mb-1 block text-sm font-medium text-[var(--text-main)]">
                Neues Passwort
              </label>
              <input
                id="set-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                minLength={6}
                required
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="set-password-confirm"
                className="mb-1 block text-sm font-medium text-[var(--text-main)]"
              >
                Passwort bestätigen
              </label>
              <input
                id="set-password-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Wiederholen"
                minLength={6}
                required
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            <div ref={submitRef}>
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Wird gespeichert…' : 'Passwort festlegen'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};
