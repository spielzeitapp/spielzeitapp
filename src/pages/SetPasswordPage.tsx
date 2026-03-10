import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { Card, CardTitle } from '../app/components/ui/Card';
import { supabase } from '../lib/supabaseClient';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

export const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate('/app/schedule', { replace: true }), 800);
  };

  return (
    <div className="page relative min-h-[50vh] px-4 pt-6">
      <div className="mx-auto max-w-[480px]">
        <Card>
          <CardTitle>Passwort festlegen</CardTitle>
          <p className="mt-1 text-sm text-[var(--text-sub)]">
            Lege ein Passwort für die Anmeldung fest. Danach kannst du dich mit E-Mail und Passwort einloggen.
            (Auch nach „Passwort vergessen“ landest du hier, um ein neues Passwort zu setzen.)
          </p>
          {success ? (
            <p className="mt-4 text-sm text-green-400">Passwort gespeichert. Du wirst weitergeleitet…</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
                <label htmlFor="set-password-confirm" className="mb-1 block text-sm font-medium text-[var(--text-main)]">
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
              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Wird gespeichert…' : 'Passwort festlegen'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
