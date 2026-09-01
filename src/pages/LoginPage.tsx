import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import spielzeitAppLogo from '../assets/branding/spielzeitapp-logo-mark.png';
import { Button } from '../app/components/ui/Button';
import { PlayerLoginPanel } from '../components/auth/PlayerLoginPanel';
import {
  isTurnstileConfigured,
  TurnstileWidget,
} from '../components/auth/TurnstileWidget';
import {
  clearEmailConfirmFlow,
  isEmailConfirmFlow,
  isSafeAuthRedirectPath,
} from '../lib/authRedirect';
import { resolvePostAuthDestination } from '../lib/postAuthDestination';
import {
  buildParentInviteAuthNext,
  buildParentInviteAuthQuery,
  clearPendingParentEmailInviteFlag,
  clearStashedParentInviteToken,
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
import '../styles/auth-login.css';

const AUTH_PAGE_SHELL_CLASS =
  'auth-login-page flex min-h-[100dvh] min-h-screen w-full flex-col items-stretch overflow-y-auto overscroll-y-contain px-4 pb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1rem))] pt-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem))] sm:py-10';
const AUTH_PAGE_CARD_CLASS =
  'relative mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#111216]/95 px-5 pb-6 pt-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:px-7 sm:pb-7 sm:pt-6';

const inputClass =
  'auth-login-input h-12 w-full rounded-xl border border-white/10 bg-[#1b1d22] pl-11 pr-4 text-[16px] text-white placeholder:text-white/35 shadow-inner transition focus:border-red-400/70 focus:outline-none focus:ring-2 focus:ring-red-500/25';

const lockedEmailDisplayClass =
  'flex h-12 w-full items-center rounded-xl border border-white/10 bg-[#1b1d22] pl-11 pr-4 text-[16px] text-white select-none [user-select:none]';

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
  const [parentInviteDismissed, setParentInviteDismissed] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

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
  const pendingInvitePath = parentInviteDismissed ? null : resolvePendingParentInvitePath(user);
  const fromInvitePath =
    fromStatePath && pathLooksLikeParentInvite(fromStatePath) && isSafeAuthRedirectPath(fromStatePath)
      ? fromStatePath.split('?')[0] || fromStatePath
      : null;
  const nextSafe = nextFromQuery || fromInvitePath || pendingInvitePath;

  const orphanTokenValid = isParentInviteTokenShape(normalizeParentInviteToken(orphanT ?? ''));
  const metaToken = readParentInviteTokenFromUserMetadata(user);
  const isParentInviteFlow = Boolean(
    !parentInviteDismissed && (
      pendingInvitePath ||
      nextSafe ||
      orphanTokenValid ||
      metaToken ||
      readStashedParentInviteEmail() ||
      (searchParams.get('email') ?? '').trim() ||
      inviteConfirmedFlag
    ),
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
    if (parentInviteDismissed) return '';
    const fromQuery = (searchParams.get('email') ?? '').trim().toLowerCase();
    if (fromQuery) return fromQuery;
    const stashed = (readStashedParentInviteEmail() ?? '').trim().toLowerCase();
    if (stashed) return stashed;
    const fromUser = (user?.email ?? '').trim().toLowerCase();
    if (isParentInviteFlow && fromUser) return fromUser;
    return '';
  }, [searchParams, user?.email, isParentInviteFlow, parentInviteDismissed]);

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
    if (isTurnstileConfigured && !captchaToken) {
      setLoading(false);
      setError('Bitte Sicherheitsprüfung abschließen.');
      return;
    }
    if (lockedInviteEmail && trimmedEmail !== lockedInviteEmail) {
      setLoading(false);
      setError('Für diese Einladung musst du die eingeladene E-Mail-Adresse verwenden.');
      return;
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    setCaptchaToken(null);
    setCaptchaResetKey((value) => value + 1);
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

  const openNormalLogin = () => {
    clearStashedParentInviteToken();
    clearPendingParentEmailInviteFlag();
    clearEmailConfirmFlow();
    setEmail('');
    setPassword('');
    setParentInviteDismissed(true);
    navigate('/login', { replace: true });
  };

  return (
    <div className={AUTH_PAGE_SHELL_CLASS}>
      <div className={AUTH_PAGE_CARD_CLASS}>
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-700 via-red-500 to-red-800" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-red-600/10 blur-3xl" />

        <header className="relative flex items-center gap-3.5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-red-400/20 bg-gradient-to-br from-red-500/15 to-black shadow-[0_10px_32px_rgba(220,38,38,0.16)]">
            <img
              src={spielzeitAppLogo}
              alt=""
              className="h-12 w-12 object-contain"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-300">
              SpielzeitApp
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">
              Willkommen zurück
            </h1>
          </div>
        </header>

        <p className="relative mt-4 text-sm leading-6 text-white/60">
          {showInviteConfirmedHint
            ? 'E-Mail bestätigt. Melde dich jetzt an, um die Einladung anzunehmen.'
            : isParentInviteFlow
              ? 'Mit der eingeladenen E-Mail anmelden, um die Eltern-Einladung fortzusetzen.'
              : 'Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.'}
        </p>
        {isParentInviteFlow ? (
          <button
            type="button"
            onClick={openNormalLogin}
            className="relative mt-3 rounded-md text-sm font-semibold text-red-300 hover:text-red-200 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/50"
          >
            Zur normalen Anmeldung
          </button>
        ) : null}

        <form onSubmit={handleSubmit} className="relative mt-5 space-y-4">
          <div>
            <label
              htmlFor={inviteEmailLocked ? 'login-email-display' : 'login-email'}
              className="mb-1.5 block text-sm font-semibold text-white/80"
            >
              E-Mail
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" aria-hidden="true" />
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
                  placeholder="name@beispiel.at"
                  required
                  autoComplete="email"
                  inputMode="email"
                  className={inputClass}
                />
              )}
            </div>
            {inviteEmailLocked ? (
              <p className="mt-1 text-xs text-white/50">
                Diese Einladung ist an diese E-Mail-Adresse gebunden.
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-white/80">
              Passwort
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <label className="flex min-w-0 items-center gap-2.5 text-sm text-white/70">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border border-white/25 bg-black/30 accent-red-500"
              />
              <span>Angemeldet bleiben</span>
            </label>
            <Link
              to="/forgot-password"
              className="shrink-0 rounded text-sm font-semibold text-red-300 hover:text-red-200 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              Passwort vergessen?
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2.5">
            <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-white/50">
              <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              Sichere Anmeldung
            </div>
            <TurnstileWidget
              onTokenChange={setCaptchaToken}
              resetKey={captchaResetKey}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-3 text-sm text-red-200" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            fullWidth
            disabled={loading || (isTurnstileConfigured && !captchaToken)}
            className="!h-12 !rounded-xl !text-base !font-bold shadow-[0_12px_28px_rgba(220,38,38,0.22)]"
          >
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </Button>
        </form>

        {playerLoginEnabled && !isParentInviteFlow ? (
          <div className="relative mt-5 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={() => setShowPlayerLogin(true)}
              className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              Spieler-Login
            </button>
            <p className="mt-2 text-center text-[11px] leading-4 text-white/45">
              Für Kinder ohne E-Mail — mit Code und PIN der Eltern
            </p>
          </div>
        ) : null}

        <div className="relative mt-4 flex flex-col gap-2.5">
          {!isParentInviteFlow && window.location.hostname !== 'spielzeitapp.at' ? (
            <>
              <Link
                to="/demo"
                className="w-full rounded-xl border border-white/12 bg-transparent px-4 py-3 text-center text-sm font-semibold text-white/85 transition hover:border-white/20 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-red-500/50"
              >
                Demo ohne Login ansehen
              </Link>
              <p className="text-center text-[11px] text-white/40">
                U12-Demoteam — gleiche App-Oberfläche
              </p>
            </>
          ) : null}

          {!isParentInviteFlow ? (
            <p className="mt-1 text-center text-sm text-white/55">
              Noch kein Konto?{' '}
              <Link
                to={
                  nextSafe
                    ? `/register?${buildParentInviteAuthQuery({ next: nextSafe, email })}`
                    : '/register'
                }
                className="rounded font-bold text-white hover:text-red-200 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/50"
              >
                Jetzt registrieren
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};
