import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, MailCheck, RefreshCw } from 'lucide-react';
import { Button } from '../app/components/ui/Button';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabaseClient';
import { AUTH_EMAIL_CONFIRM_PATH, getAuthRedirectUrl, isSafeAuthRedirectPath } from '../lib/authRedirect';
import {
  buildParentInviteAuthQuery,
  ensureParentInviteContextFromNext,
  extractInviteTokenFromNext,
  readStashedParentInviteEmail,
  readStashedParentInviteToken,
  resolvePendingParentInvitePath,
  stashParentInviteEmail,
  stashParentInviteToken,
} from '../lib/parentLinkInvites';
import { isParentInviteTokenShape, normalizeParentInviteToken } from '../lib/parentChildLink';
import { resolvePostAuthDestination } from '../lib/postAuthDestination';
import { clearAccountScopedClientState } from '../lib/accountScopedStorage';
import {
  isTurnstileConfigured,
  TurnstileWidget,
} from '../components/auth/TurnstileWidget';

const AUTH_PAGE_SHELL_CLASS =
  'flex min-h-[100dvh] min-h-screen w-full flex-col items-stretch overflow-y-auto overscroll-y-contain px-4 pb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1rem))] pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))]';
const AUTH_PAGE_CARD_CLASS =
  'mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl';

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

const lockedEmailDisplayClass =
  'flex h-12 w-full items-center rounded-xl border border-white/15 bg-white/5 px-4 text-white select-none [user-select:none]';

const MIN_PASSWORD_LENGTH = 6;

async function completeInviteSignup(input: {
  token: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{
  ok: boolean;
  error: string | null;
  needsConfirm: boolean;
  confirmationEmailSent: boolean | null;
}> {
  try {
    const res = await fetch('/api/parent/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'complete_signup',
        token: input.token,
        email: input.email,
        password: input.password,
        first_name: input.firstName,
        last_name: input.lastName,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || payload.ok !== true) {
      const err = String(payload.error ?? 'signup_failed');
      const messages: Record<string, string> = {
        account_exists: 'Für diese E-Mail existiert bereits ein Konto. Bitte anmelden.',
        email_mismatch: 'Für diese Einladung musst du die eingeladene E-Mail-Adresse verwenden.',
        expired: 'Diese Einladung ist abgelaufen.',
        revoked: 'Diese Einladung wurde widerrufen.',
        already_used: 'Diese Einladung wurde bereits verwendet.',
        invalid_token: 'Einladung ungültig.',
        weak_password: `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`,
      };
      return {
        ok: false,
        error: messages[err] ?? 'Registrierung fehlgeschlagen.',
        needsConfirm: false,
        confirmationEmailSent: null,
      };
    }
    return {
      ok: true,
      error: null,
      needsConfirm: String(payload.status) === 'pending_email_confirmation',
      confirmationEmailSent:
        typeof payload.email_confirm_sent === 'boolean' ? payload.email_confirm_sent : null,
    };
  } catch {
    return {
      ok: false,
      error: 'Registrierung fehlgeschlagen.',
      needsConfirm: false,
      confirmationEmailSent: null,
    };
  }
}

/** Redirect nach E-Mail-Bestätigung — aktueller Host (index.html leitet / → /app). */
export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session, loading: authLoading } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [confirmationEmailSent, setConfirmationEmailSent] = useState<boolean | null>(null);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [resendStatus, setResendStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const nextRaw = searchParams.get('next') ?? '';
  const nextSafe = isSafeAuthRedirectPath(nextRaw) ? nextRaw : null;
  const pendingInvitePath = resolvePendingParentInvitePath();
  const emailRedirectPath = pendingInvitePath || nextSafe || AUTH_EMAIL_CONFIRM_PATH;
  const isParentInviteFlow = Boolean(
    pendingInvitePath || (nextSafe && nextSafe.includes('/app/parent-invite')),
  );
  const inviteEmailLocked = Boolean(
    (searchParams.get('email') ?? '').trim() ||
      readStashedParentInviteEmail() ||
      (isParentInviteFlow && user?.email),
  );

  const inviteToken = (() => {
    const fromNext = extractInviteTokenFromNext(nextSafe);
    if (fromNext) return fromNext;
    const stashed = normalizeParentInviteToken(readStashedParentInviteToken() ?? '');
    return isParentInviteTokenShape(stashed) ? stashed : null;
  })();

  useEffect(() => {
    ensureParentInviteContextFromNext(nextSafe);
    const prefill =
      (searchParams.get('email') ?? '').trim().toLowerCase() ||
      readStashedParentInviteEmail() ||
      '';
    if (prefill) {
      setEmail(prefill);
      stashParentInviteEmail(prefill);
    }
  }, [searchParams, nextSafe]);

  // Magic-Link kann mit Session auf /register landen — Passwort/Name setzen, dann Accept.
  const hasInviteSession = Boolean(isParentInviteFlow && user && session);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage(null);
    setNeedsEmailConfirmation(false);
    setConfirmationEmailSent(null);
    setResendStatus(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const lockedEmail =
      (searchParams.get('email') ?? '').trim().toLowerCase() ||
      (readStashedParentInviteEmail() ?? '').trim().toLowerCase() ||
      (user?.email ?? '').trim().toLowerCase();

    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      setMessage({ type: 'error', text: 'Bitte Vorname, Nachname und E-Mail ausfüllen.' });
      return;
    }

    if (lockedEmail && trimmedEmail !== lockedEmail) {
      setMessage({
        type: 'error',
        text: 'Für diese Einladung musst du die eingeladene E-Mail-Adresse verwenden.',
      });
      return;
    }

    if (isParentInviteFlow && trimmedEmail) {
      stashParentInviteEmail(trimmedEmail);
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage({ type: 'error', text: `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.` });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwörter stimmen nicht überein.' });
      return;
    }

    if (!hasInviteSession && !isParentInviteFlow && isTurnstileConfigured && !captchaToken) {
      setMessage({ type: 'error', text: 'Bitte Sicherheitsprüfung abschließen.' });
      return;
    }

    setLoading(true);

    try {
      // Bereits per Magic-Link bestätigt: Passwort setzen und zur Einladung.
      if (hasInviteSession) {
        const { error: updateError } = await supabase.auth.updateUser({
          password,
          data: {
            first_name: trimmedFirst,
            last_name: trimmedLast,
            spielzeit_parent_invite: true,
            ...(inviteToken ? { spielzeit_parent_invite_token: inviteToken } : {}),
          },
        });
        if (updateError) {
          setError(updateError.message);
          setMessage({ type: 'error', text: updateError.message });
          setLoading(false);
          return;
        }
        clearAccountScopedClientState();
        const dest = await resolvePostAuthDestination({
          user,
          next: nextSafe,
          consciousLogin: false,
          parentInviteFlowHint: true,
        });
        setLoading(false);
        if (dest.hardReplace) {
          window.location.replace(dest.path);
          return;
        }
        navigate(dest.path, { replace: true });
        return;
      }

      // Invite flow ohne Session: token-bound complete_signup (passwordless stubs).
      if (isParentInviteFlow && inviteToken) {
        stashParentInviteToken(inviteToken);
        const completed = await completeInviteSignup({
          token: inviteToken,
          email: trimmedEmail,
          password,
          firstName: trimmedFirst,
          lastName: trimmedLast,
        });
        if (!completed.ok) {
          setError(completed.error || 'Registrierung fehlgeschlagen.');
          setMessage({ type: 'error', text: completed.error || 'Registrierung fehlgeschlagen.' });
          setLoading(false);
          if (completed.error?.includes('bereits ein Konto')) {
            const qs = buildParentInviteAuthQuery({
              next: pendingInvitePath || nextSafe || '/app/parent-invite',
              email: trimmedEmail,
            });
            navigate(`/login?${qs}`, { replace: true });
          }
          return;
        }
        setNeedsEmailConfirmation(true);
        setConfirmationEmailSent(completed.confirmationEmailSent);
        setMessage({
          type: 'success',
          text: 'Konto angelegt. Bitte bestätige deine E-Mail-Adresse, um die Registrierung abzuschließen. Danach kannst du die persönliche Einladung annehmen und dein Kind direkt mit deinem Elternkonto verknüpfen — ohne Rollen- oder Mannschaftswahl.',
        });
        setLoading(false);
        return;
      }

      const signUpPayload = {
        email: trimmedEmail,
        password,
        options: {
          data: { first_name: trimmedFirst, last_name: trimmedLast },
          emailRedirectTo: getAuthRedirectUrl(emailRedirectPath),
          ...(captchaToken ? { captchaToken } : {}),
        },
      };

      const result = await supabase.auth.signUp(signUpPayload);
      setCaptchaToken(null);
      setCaptchaResetKey((value) => value + 1);
      const { data, error: signUpError } = result;

      if (signUpError) {
        setError(signUpError.message);
        setMessage({ type: 'error', text: signUpError.message });
        setLoading(false);
        return;
      }

      if (data.session) {
        setLoading(false);
        clearAccountScopedClientState();
        const dest = await resolvePostAuthDestination({
          user: data.session.user,
          next: nextSafe,
          consciousLogin: !isParentInviteFlow,
          parentInviteFlowHint: isParentInviteFlow,
        });
        if (dest.hardReplace) {
          window.location.replace(dest.path);
          return;
        }
        if (dest.kind === 'parent_invite' || dest.kind === 'deep_link' || dest.kind === 'branded_entry') {
          navigate(dest.path, { replace: true });
          return;
        }
        navigate(pendingInvitePath || nextSafe || '/app/role-choice', { replace: true });
        return;
      }

      setNeedsEmailConfirmation(true);
      setConfirmationEmailSent(null);
      setMessage({
        type: 'success',
        text: isParentInviteFlow
          ? 'Konto angelegt. Bitte bestätige deine E-Mail-Adresse. Danach geht es direkt mit der Einladung weiter — ohne Rollen- oder Mannschaftswahl.'
          : 'Konto angelegt. Bitte bestätige deine E-Mail-Adresse. Danach geht es mit der Rollenwahl weiter — ohne erneutes Passwort.',
      });
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setMessage({ type: 'error', text: msg });
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || resendingConfirmation) return;
    if (isTurnstileConfigured && !captchaToken) {
      setResendStatus({ type: 'error', text: 'Bitte Sicherheitsprüfung abschließen.' });
      return;
    }

    setResendingConfirmation(true);
    setResendStatus(null);
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: trimmedEmail,
      options: {
        emailRedirectTo: getAuthRedirectUrl(emailRedirectPath),
        captchaToken: captchaToken ?? undefined,
      },
    });
    setCaptchaToken(null);
    setCaptchaResetKey((value) => value + 1);
    setResendingConfirmation(false);

    if (resendError) {
      const rateLimited = /rate|security purposes|seconds/i.test(resendError.message);
      setResendStatus({
        type: 'error',
        text: rateLimited
          ? 'Bitte kurz warten und danach noch einmal versuchen.'
          : 'Die E-Mail konnte nicht erneut gesendet werden. Bitte später nochmals versuchen.',
      });
      return;
    }

    setConfirmationEmailSent(true);
    setResendStatus({
      type: 'success',
      text: 'Neue Bestätigungs-E-Mail wurde versendet.',
    });
  };

  if (needsEmailConfirmation) {
    return (
      <div className={AUTH_PAGE_SHELL_CLASS}>
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(155deg,rgba(30,30,33,0.98),rgba(8,8,10,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <div className="h-1 bg-gradient-to-r from-red-800 via-red-500 to-red-800" aria-hidden />
          <div className="px-5 py-6 sm:px-7 sm:py-8">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-300 shadow-[0_0_28px_rgba(220,38,38,0.16)]">
              <MailCheck className="h-7 w-7" aria-hidden />
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-red-400">
              Fast geschafft
            </p>
            <h1 className="mt-1 text-[28px] font-black leading-tight text-white">E-Mail bestätigen</h1>
            <p className="mt-3 text-[15px] leading-6 text-white/68">
              Wir haben den Bestätigungslink an diese Adresse gesendet:
            </p>
            <div className="mt-3 break-all rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center text-[15px] font-bold text-white">
              {email.trim().toLowerCase()}
            </div>

            {confirmationEmailSent === false ? (
              <div className="mt-4 flex gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3.5 py-3 text-[13px] leading-5 text-amber-100">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                <span>Der erste Versand hat nicht funktioniert. Bitte sende die E-Mail erneut.</span>
              </div>
            ) : (
              <div className="mt-4 flex gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-3.5 py-3 text-[13px] leading-5 text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                <span>Öffne die E-Mail und tippe auf den Bestätigungslink.</span>
              </div>
            )}

            <div className="mt-5 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="text-[13px] font-semibold text-white/80">Keine E-Mail erhalten?</p>
              <p className="mt-1 text-[12px] leading-5 text-white/55">
                Warte kurz und prüfe auch Spam, Junk oder Werbung.
              </p>
            </div>

            {resendStatus ? (
              <div
                className={`mt-3 rounded-xl border px-3.5 py-3 text-[13px] leading-5 ${
                  resendStatus.type === 'success'
                    ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100'
                    : 'border-red-400/25 bg-red-500/10 text-red-100'
                }`}
                role="status"
              >
                {resendStatus.text}
              </div>
            ) : null}

            <div className="mt-4">
              <TurnstileWidget
                onTokenChange={setCaptchaToken}
                resetKey={captchaResetKey}
              />
            </div>

            <button
              type="button"
              onClick={() => void handleResendConfirmation()}
              disabled={resendingConfirmation || (isTurnstileConfigured && !captchaToken)}
              className="mt-4 grid min-h-12 w-full grid-flow-col place-content-center items-center gap-2 rounded-xl bg-red-600 px-4 text-[15px] font-bold text-white shadow-[0_10px_28px_rgba(220,38,38,0.22)] transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${resendingConfirmation ? 'animate-spin' : ''}`} aria-hidden />
              {resendingConfirmation ? 'Wird gesendet…' : 'E-Mail erneut senden'}
            </button>

            <p className="mt-4 text-center text-[12px] leading-5 text-white/45">
              {isParentInviteFlow
                ? 'Nach der Bestätigung öffnet sich deine persönliche Einladung.'
                : 'Nach der Bestätigung geht es automatisch zur Rollenwahl.'}
              {' '}Dein Passwort bleibt gespeichert.
            </p>

            <div className="mt-5 border-t border-white/10 pt-4 text-center text-sm">
            <Link
              to={
                nextSafe
                  ? `/login?${buildParentInviteAuthQuery({ next: nextSafe, email })}`
                  : '/login'
              }
              className="font-semibold text-white/65 hover:text-white hover:underline"
            >
              Zur Anmeldung
            </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className={AUTH_PAGE_SHELL_CLASS}>
        <p className="text-sm text-white/60">Laden…</p>
      </div>
    );
  }

  return (
    <div className={AUTH_PAGE_SHELL_CLASS}>
      <div className={AUTH_PAGE_CARD_CLASS}>
        <h1 className="text-xl font-semibold text-white">
          {hasInviteSession ? 'Konto vervollständigen' : 'Registrieren'}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {isParentInviteFlow
            ? hasInviteSession
              ? 'Name und Passwort setzen. Danach geht es direkt zur Einladung — ohne Rollen- oder Mannschaftswahl.'
              : 'Konto mit der eingeladenen E-Mail anlegen. Nach der Bestätigung kannst du die Einladung annehmen — ohne Vereins- oder Kindauswahl.'
            : 'Konto anlegen – danach kannst du Rolle, Team und Kind verknüpfen.'}
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
            <label
              htmlFor={inviteEmailLocked ? 'reg-email-display' : 'reg-email'}
              className="mb-1 block text-sm font-medium text-white/80"
            >
              E-Mail
            </label>
            {inviteEmailLocked ? (
              <p id="reg-email-display" className={lockedEmailDisplayClass} aria-readonly="true">
                {email}
              </p>
            ) : (
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                placeholder="name@beispiel.de"
                required
                autoComplete="email"
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
            <label htmlFor="reg-password" className="mb-1 block text-sm font-medium text-white/80">
              Passwort
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
                minLength={MIN_PASSWORD_LENGTH}
                required
                autoComplete="new-password"
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-white/60 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/70"
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="reg-confirm-password" className="mb-1 block text-sm font-medium text-white/80">
              Passwort wiederholen
            </label>
            <div className="relative">
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
                minLength={MIN_PASSWORD_LENGTH}
                required
                autoComplete="new-password"
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-white/60 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/70"
                aria-label={showConfirmPassword ? 'Passwortbestätigung verbergen' : 'Passwortbestätigung anzeigen'}
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
              </button>
            </div>
          </div>

          {!hasInviteSession && !isParentInviteFlow ? (
            <TurnstileWidget
              onTokenChange={setCaptchaToken}
              resetKey={captchaResetKey}
            />
          ) : null}

          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`} role="status">
              {message.text}
            </p>
          )}

          <Button
            type="submit"
            fullWidth
            disabled={
              loading ||
              (!hasInviteSession &&
                !isParentInviteFlow &&
                isTurnstileConfigured &&
                !captchaToken)
            }
            className="mt-2"
          >
            {loading
              ? 'Wird gespeichert…'
              : hasInviteSession
                ? 'Speichern und weiter'
                : 'Konto anlegen'}
          </Button>
        </form>

        <p className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-white/60">
          Bereits registriert?{' '}
          <Link
            to={
              nextSafe || pendingInvitePath
                ? `/login?${buildParentInviteAuthQuery({
                    next: nextSafe || pendingInvitePath || '',
                    email,
                  })}`
                : '/login'
            }
            className="text-white/80 hover:text-white hover:underline"
          >
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
};
