import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { PlayerLoginPanel } from '../components/auth/PlayerLoginPanel';
import {
  clearEmailConfirmFlow,
  isEmailConfirmFlow,
  isSafeAuthRedirectPath,
} from '../lib/authRedirect';
import { resolvePostAuthDestination } from '../lib/postAuthDestination';
import {
  buildParentInviteAuthNext,
  buildParentInviteAuthQuery,
  ensureParentInviteContextFromNext,
  isAppIntroEntryPath,
  readParentInviteTokenFromUserMetadata,
  readStashedParentInviteEmail,
  readStashedParentInviteToken,
  resolvePendingParentInvitePath,
  stashParentInviteEmail,
  stashParentInviteToken,
} from '../lib/parentLinkInvites';
import { clearAccountScopedClientState } from '../lib/accountScopedStorage';
import { isParentInviteTokenShape, normalizeParentInviteToken } from '../lib/parentChildLink';
import { isPlayerQrAccessEnabled } from '../lib/playerAccessFeature';
import { setRememberMePreference, supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth/AuthProvider';

const AUTH_PAGE_SHELL_CLASS =
  'flex min-h-[100dvh] min-h-screen w-full flex-col items-stretch overflow-y-auto overscroll-y-contain px-4 pb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1rem))] pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))]';
const AUTH_PAGE_CARD_CLASS =
  'mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

const lockedEmailDisplayClass =
  'flex h-12 w-full items-center rounded-xl border border-white/15 bg-white/5 px-4 text-white select-none [user-select:none]';

function stashTokenIfValid(raw: string | null | undefined): string | null {
  const token = normalizeParentInviteToken(raw ?? '');
  if (!isParentInviteTokenShape(token)) return null;
  stashParentInviteToken(token);
  return token;
}

function pathLooksLikeParentInvite(path: string | null | undefined): boolean {
  if (!path) return false;
  return path.includes('/app/parent-invite');
}

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPlayerLogin, setShowPlayerLogin] = useState(false);

  const fromState = (location.state as { from?: { pathname: string; search?: string } })?.from;
  const fromStatePath = fromState?.pathname
    ? `${fromState.pathname}${fromState.search ?? ''}`
    : null;
  const nextRaw = searchParams.get('next') ?? '';
  const nextFromQuery = isSafeAuthRedirectPath(nextRaw) ? nextRaw : null;
  const orphanT = searchParams.get('t');
  const inviteConfirmedFlag =
    searchParams.get('invite_confirmed') === '1' || searchParams.get('invite_confirmed') === 'true';

  // Recover invite next from RequireAuth from-state or stash/metadata (Confirm Site-URL fallback).
  const pendingInvitePath = resolvePendingParentInvitePath(user);
  const fromInvitePath =
    fromStatePath && pathLooksLikeParentInvite(fromStatePath) && isSafeAuthRedirectPath(fromStatePath)
      ? fromStatePath.split('?')[0] || fromStatePath
      : null;
  const nextSafe = nextFromQuery || fromInvitePath || pendingInvitePath;

  const orphanTokenValid = isParentInviteTokenShape(normalizeParentInviteToken(orphanT ?? ''));
  const metaToken = readParentInviteTokenFromUserMetadata(user);
  const isParentInviteFlow = Boolean(
    pendingInvitePath ||
      nextSafe ||
      orphanTokenValid ||
      metaToken ||
      readStashedParentInviteEmail() ||
      (searchParams.get('email') ?? '').trim() ||
      inviteConfirmedFlag,
  );

  const showInviteConfirmedHint = Boolean(
    isParentInviteFlow && (inviteConfirmedFlag || isEmailConfirmFlow()),
  );

  /** Nur echte RequireAuth-/Deep-Link-Herkunft — kein Termine-Default. */
  const safeFromState =
    fromStatePath &&
    isSafeAuthRedirectPath(fromStatePath) &&
    !(isParentInviteFlow && isAppIntroEntryPath(fromStatePath))
      ? fromStatePath
      : null;

  const playerLoginEnabled = isPlayerQrAccessEnabled();
  const lockedInviteEmail = useMemo(() => {
    const fromQuery = (searchParams.get('email') ?? '').trim().toLowerCase();
    if (fromQuery) return fromQuery;
    const stashed = (readStashedParentInviteEmail() ?? '').trim().toLowerCase();
    if (stashed) return stashed;
    const fromUser = (user?.email ?? '').trim().toLowerCase();
    if (isParentInviteFlow && fromUser) return fromUser;
    return '';
  }, [searchParams, user?.email, isParentInviteFlow]);

  const inviteEmailLocked = Boolean(lockedInviteEmail);

  useEffect(() => {
    ensureParentInviteContextFromNext(nextSafe);
    stashTokenIfValid(orphanT);
    if (metaToken) stashParentInviteToken(metaToken);
    const stashedToken = readStashedParentInviteToken();
    if (stashedToken && isParentInviteTokenShape(stashedToken) && !nextFromQuery) {
      ensureParentInviteContextFromNext(buildParentInviteAuthNext(stashedToken));
    }
    if (lockedInviteEmail) {
      setEmail(lockedInviteEmail);
      stashParentInviteEmail(lockedInviteEmail);
    }
  }, [searchParams, nextSafe, orphanT, metaToken, lockedInviteEmail, nextFromQuery]);

  // Confirm / Magic-Link landete auf /login mit Session → Invite-Accept (kein Splash).
  useEffect(() => {
    if (authLoading || !user || !isParentInviteFlow) return;
    let cancelled = false;
    (async () => {
      const meta = readParentInviteTokenFromUserMetadata(user);
      if (meta) stashParentInviteToken(meta);
      ensureParentInviteContextFromNext(nextSafe);
      const dest = await resolvePostAuthDestination({
        user,
        next: nextSafe,
        from: safeFromState,
        consciousLogin: false,
        parentInviteFlowHint: true,
      });
      if (cancelled) return;
      clearEmailConfirmFlow();
      if (dest.hardReplace) {
        window.location.replace(dest.path);
        return;
      }
      navigate(dest.path, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, isParentInviteFlow, nextSafe, safeFromState, navigate]);

  if (showPlayerLogin) {
    return (
      <div className={AUTH_PAGE_SHELL_CLASS}>
        <PlayerLoginPanel onBack={() => setShowPlayerLogin(false)} />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setRememberMePreference(rememberMe);
    ensureParentInviteContextFromNext(nextSafe);
    stashTokenIfValid(orphanT);

    const trimmedEmail = email.trim().toLowerCase();
    if (lockedInviteEmail && trimmedEmail !== lockedInviteEmail) {
      setLoading(false);
      setError('Für diese Einladung musst du die eingeladene E-Mail-Adresse verwenden.');
      return;
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    clearAccountScopedClientState();

    const recoveredMeta = readParentInviteTokenFromUserMetadata(signInData.user);
    if (recoveredMeta) stashParentInviteToken(recoveredMeta);
    ensureParentInviteContextFromNext(nextSafe);
    stashTokenIfValid(orphanT);
    if (lockedInviteEmail) stashParentInviteEmail(lockedInviteEmail);

    const dest = await resolvePostAuthDestination({
      user: signInData.user,
      next: nextSafe,
      from: safeFromState,
      // Invite wins over splash inside resolvePostAuthDestination.
      consciousLogin: !isParentInviteFlow,
      parentInviteFlowHint: isParentInviteFlow,
    });

    clearEmailConfirmFlow();

    if (dest.hardReplace) {
      window.location.replace(dest.path);
      return;
    }
    navigate(dest.path, { replace: true });
  };

  return (
    <div className={AUTH_PAGE_SHELL_CLASS}>
      <div className={AUTH_PAGE_CARD_CLASS}>
        <h1 className="text-xl font-semibold text-white">Anmelden</h1>
        <p className="mt-1 text-sm text-white/60">
          {showInviteConfirmedHint
            ? 'E-Mail bestätigt. Melde dich jetzt an, um die Einladung anzunehmen.'
            : isParentInviteFlow
              ? 'Mit der eingeladenen E-Mail anmelden, um die Eltern-Einladung fortzusetzen.'
              : 'E-Mail und Passwort eingeben'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor={inviteEmailLocked ? 'login-email-display' : 'login-email'}
              className="mb-1 block text-sm font-medium text-white/80"
            >
              E-Mail
            </label>
            {inviteEmailLocked ? (
              <p id="login-email-display" className={lockedEmailDisplayClass} aria-readonly="true">
                {email}
              </p>
            ) : (
              <input
                id="login-email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                placeholder="name@beispiel.de"
                required
                autoComplete="email"
                inputMode="email"
                className={inputClass}
              />
            )}
            {inviteEmailLocked ? (
              <p className="mt-1 text-xs text-white/50">
                Diese Einladung ist an diese E-Mail-Adresse gebunden.
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-white/80">
              Passwort
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
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
          <label className="flex items-center gap-2.5 pt-0.5 text-sm text-white/75">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border border-white/25 bg-black/30 accent-red-500"
            />
            <span>Immer angemeldet bleiben</span>
          </label>

          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}

          <Button type="submit" fullWidth disabled={loading} className="mt-2">
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </Button>
        </form>

        {playerLoginEnabled && !isParentInviteFlow ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setShowPlayerLogin(true)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Spieler-Login
            </button>
            <p className="mt-2 text-center text-[11px] text-white/50">
              Für Kinder ohne E-Mail — Code und PIN von den Eltern
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
          {!isParentInviteFlow && window.location.hostname !== 'spielzeitapp.at' ? (
            <>
              <Link
                to="/demo"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Demo ansehen
              </Link>
              <p className="text-center text-[11px] text-white/45">
                U12-Demoteam ohne Login — gleiche App-Oberfläche
              </p>
            </>
          ) : null}
          <Link
            to="/forgot-password"
            className="text-sm text-white/60 hover:text-white/90 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded"
          >
            Passwort vergessen?
          </Link>
          {!isParentInviteFlow ? (
            <Link
              to={
                nextSafe
                  ? `/register?${buildParentInviteAuthQuery({ next: nextSafe, email })}`
                  : '/register'
              }
              className="text-sm text-white/60 hover:text-white/90 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/60 rounded"
            >
              Noch kein Konto? Registrieren
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
};
