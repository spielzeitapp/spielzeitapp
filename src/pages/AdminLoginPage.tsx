import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../app/components/ui/Button';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

export const AdminLoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('[ADMIN AUTH LOGIN START]', { email: email.trim() });
    const { error: signInError } = await signIn(email, password);
    setLoading(false);

    if (signInError) {
      console.log('[ADMIN AUTH LOGIN ERROR]', signInError);
      setError(signInError.message);
    } else {
      console.log('[ADMIN AUTH LOGIN SUCCESS]');
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Admin Login</h1>
        <p className="mt-1 text-xs text-white/60">Nur für Trainer/Admin gedacht.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-white/80">
              E-Mail
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trainer@verein.at"
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-white/80">
              Passwort
            </label>
            <div className="relative">
              <input
                id="admin-password"
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

          {error && (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth disabled={loading} className="mt-2">
            {loading ? 'Wird angemeldet…' : 'Einloggen'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-white/60">
          <Link to="/forgot-password" className="hover:text-white hover:underline">
            Passwort vergessen?
          </Link>
        </p>
      </div>
    </div>
  );
};

