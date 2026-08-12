import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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

const inputClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/60';

const MIN_PASSWORD_LENGTH = 6;

async function completeInviteSignup(input: {
  token: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ ok: boolean; error: string | null; needsConfirm: boolean }> {
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
      return { ok: false, error: messages[err] ?? 'Registrierung fehlgeschlagen.', needsConfirm: false };
    }
    return {
      ok: true,
      error: null,
      needsConfirm: String(payload.status) === 'pending_email_confirmation',
    };
  } catch {
    return { ok: false, error: 'Registrierung fehlgeschlagen.', needsConfirm: false };
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const nextRaw = searchParams.get('next') ?? '';
  const nextSafe = isSafeAuthRedirectPath(nextRaw) ? nextRaw : null;
  const pendingInvitePath = resolvePendingParentInvitePath();
  const emailRedirectPath = pendingInvitePath || nextSafe || AUTH_EMAIL_CONFIRM_PATH;
  const inviteEmailLocked = Boolean(
    (searchParams.get('email') ?? '').trim() ||
      readStashedParentInviteEmail() ||
      (isParentInviteFlow && user?.email),
  );
  const isParentInviteFlow = Boolean(
    pendingInvitePath || (nextSafe && nextSafe.includes('/app/parent-invite')),
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
        setMessage({
          type: 'success',
          text: 'Konto angelegt. Bitte bestätige deine E-Mail-Adresse. Danach geht es direkt mit der Einladung weiter — ohne Rollen- oder Mannschaftswahl.',
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
        },
      };

      const result = await supabase.auth.signUp(signUpPayload);
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

  if (needsEmailConfirmation) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
          <h1 className="text-xl font-semibold text-white">E-Mail bestätigen</h1>
          <p className="mt-2 text-sm text-white/70">
            {isParentInviteFlow
              ? 'Bitte bestätige deine E-Mail-Adresse. Danach öffnet sich die Einladung — ohne Rollen- oder Teamauswahl. Dein Passwort bleibt gültig.'
              : 'Bitte bestätige deine E-Mail-Adresse. Nach dem Klick auf den Bestätigungslink geht es weiter zur Rollenwahl. Dein Passwort bleibt gültig — du musst es nicht erneut setzen.'}
          </p>
          <p className="mt-4 text-center text-sm text-white/60">
            <Link
              to={
                nextSafe
                  ? `/login?${buildParentInviteAuthQuery({ next: nextSafe, email })}`
                  : '/login'
              }
              className="text-white/80 hover:text-white hover:underline"
            >
              Zur Anmeldung
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
        <p className="text-sm text-white/60">Laden…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-6 py-8 shadow-xl">
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
            <label htmlFor="reg-email" className="mb-1 block text-sm font-medium text-white/80">
              E-Mail
            </label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => {
                if (inviteEmailLocked) return;
                setEmail(e.target.value.trim().toLowerCase());
              }}
              placeholder="name@beispiel.de"
              required
              readOnly={inviteEmailLocked}
              autoComplete="email"
              className={inputClass}
            />
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
