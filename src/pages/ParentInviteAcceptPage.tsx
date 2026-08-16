import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { Card, CardTitle } from '../app/components/ui/Card';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import {
  clearParentLinkDeferred,
  isParentInviteTokenShape,
  normalizeParentInviteToken,
  persistParentRoleChoice,
  redeemOpenParentEmailInviteForMe,
  redeemParentLinkInvite,
} from '../lib/parentChildLink';
import {
  buildParentInviteAuthNext,
  buildParentInviteAuthQuery,
  captureParentInviteTokenFromUrl,
  clearParentInviteTokenFromUserMetadata,
  clearPendingParentEmailInviteFlag,
  clearStashedParentInviteToken,
  hasOpenParentEmailInviteForMe,
  markPendingParentEmailInvite,
  peekParentLinkInvite,
  previewOpenParentEmailInviteForMe,
  previewParentLinkInvite,
  readParentInviteTokenFromUserMetadata,
  readPendingParentEmailInviteFlag,
  readStashedParentInviteEmail,
  readStashedParentInviteToken,
  stashParentInviteEmail,
  stashParentInviteToken,
  type ParentInvitePreview,
} from '../lib/parentLinkInvites';
import { clearAccountScopedClientState } from '../lib/accountScopedStorage';
import { supabase } from '../lib/supabaseClient';
import { isSafeAuthRedirectPath } from '../lib/authRedirect';

const TEAM_SEASON_STORAGE_KEY = 'spielzeit_team_season_id';

function goHomeWithTeamSeason(teamSeasonId: string | null) {
  try {
    clearAccountScopedClientState();
    if (teamSeasonId) {
      window.localStorage.setItem(TEAM_SEASON_STORAGE_KEY, teamSeasonId);
    }
  } catch {
    /* ignore */
  }
  window.location.assign('/app/home');
}

function resolveTokenFromSources(opts: {
  pathToken?: string | null;
  queryToken?: string | null;
  user?: { user_metadata?: Record<string, unknown> | null } | null;
}): string | null {
  captureParentInviteTokenFromUrl();
  const candidates = [
    opts.pathToken,
    opts.queryToken,
    readStashedParentInviteToken(),
    readParentInviteTokenFromUserMetadata(opts.user),
  ];
  for (const raw of candidates) {
    const token = normalizeParentInviteToken(raw ?? '');
    if (isParentInviteTokenShape(token)) {
      stashParentInviteToken(token);
      return token;
    }
  }
  return null;
}

export const ParentInviteAcceptPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { setPreviewRole, reloadSessionTeamSeasons } = useSession();

  const [token, setToken] = useState<string | null>(() =>
    resolveTokenFromSources({
      pathToken: params.token,
      queryToken: searchParams.get('t'),
      user: null,
    }),
  );
  const [emailBoundMode, setEmailBoundMode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [authRoutePending, setAuthRoutePending] = useState(false);
  const [preview, setPreview] = useState<ParentInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** After linked/already_linked redeem: ignore late peek/preview overwrites. */
  const redeemSuccessRef = useRef(false);

  useEffect(() => {
    if (redeemSuccessRef.current) return;
    const resolved = resolveTokenFromSources({
      pathToken: params.token,
      queryToken: searchParams.get('t'),
      user,
    });
    setToken(resolved);
    if (resolved) {
      setEmailBoundMode(false);
      const canonical = buildParentInviteAuthNext(resolved);
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (!currentPath.startsWith(`/app/parent-invite/${resolved}`)) {
        navigate(canonical, { replace: true });
      }
    }
  }, [params.token, searchParams, user, navigate]);

  useEffect(() => {
    let alive = true;
    async function loadPeek() {
      if (redeemSuccessRef.current) return;
      if (!token) {
        setInviteEmail(readStashedParentInviteEmail() || user?.email?.trim().toLowerCase() || null);
        setAccountExists(false);
        return;
      }
      const peek = await peekParentLinkInvite(token);
      if (!alive || redeemSuccessRef.current) return;
      if (peek.status === 'ready') {
        if (peek.recipientEmail) {
          stashParentInviteEmail(peek.recipientEmail);
          setInviteEmail(peek.recipientEmail);
        }
        setAccountExists(peek.accountExists === true);
        return;
      }
      // Peek terminal status only when logged out — never overwrite auth preview.
      if (!user && peek.status !== 'ready' && peek.status !== 'error') {
        setPreview({
          status: peek.status,
          playerDisplayName: null,
          teamLabel: null,
          seasonLabel: null,
          expiresAt: peek.expiresAt,
          expectedEmailMasked: peek.recipientEmailMasked,
          message: peek.message,
        });
      }
      setInviteEmail(readStashedParentInviteEmail());
      setAccountExists(false);
    }
    void loadPeek();
    return () => {
      alive = false;
    };
  }, [token, user]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (redeemSuccessRef.current) return;
      setLoading(true);
      setError(null);
      setAuthRoutePending(false);

      if (authLoading) {
        return;
      }

      if (!user) {
        if (!alive || redeemSuccessRef.current) return;
        if (!token) {
          setEmailBoundMode(false);
          setPreview(null);
          setLoading(false);
          return;
        }

        const peek = await peekParentLinkInvite(token);
        if (!alive || redeemSuccessRef.current) return;
        if (peek.status !== 'ready' && peek.status !== 'error') {
          setPreview({
            status: peek.status,
            playerDisplayName: null,
            teamLabel: null,
            seasonLabel: null,
            expiresAt: peek.expiresAt,
            expectedEmailMasked: peek.recipientEmailMasked,
            message: peek.message,
          });
          setLoading(false);
          return;
        }
        if (peek.status === 'ready') {
          const email = peek.recipientEmail;
          if (email) {
            stashParentInviteEmail(email);
            setInviteEmail(email);
          }
          setAccountExists(peek.accountExists === true);
          const nextPath = buildParentInviteAuthNext(token);
          const qs = buildParentInviteAuthQuery({ next: nextPath, email });
          const confirmed =
            typeof window !== 'undefined' &&
            (window.sessionStorage.getItem('sz_auth_email_confirm') === '1' ||
              new URLSearchParams(window.location.search).get('invite_confirmed') === '1');
          const target = peek.accountExists
            ? `/login?${qs}${confirmed ? '&invite_confirmed=1' : ''}`
            : `/register?${qs}`;
          setAuthRoutePending(true);
          setLoading(false);
          navigate(target, { replace: true });
          return;
        }

        setPreview({
          status: 'needs_auth',
          playerDisplayName: null,
          teamLabel: null,
          seasonLabel: null,
          expiresAt: null,
          expectedEmailMasked: null,
          message: 'Bitte zuerst anmelden oder registrieren.',
        });
        setLoading(false);
        return;
      }

      if (token) {
        setEmailBoundMode(false);
        const result = await previewParentLinkInvite(token);
        if (!alive || redeemSuccessRef.current) return;
        setPreview(result);
        setLoading(false);
        return;
      }

      // Kein Plain-Token: offene Einladung über verifizierte Auth-E-Mail laden
      const open = readPendingParentEmailInviteFlag() || (await hasOpenParentEmailInviteForMe());
      if (!alive || redeemSuccessRef.current) return;
      if (!open) {
        setEmailBoundMode(false);
        setPreview(null);
        setLoading(false);
        return;
      }

      markPendingParentEmailInvite();
      setEmailBoundMode(true);
      const result = await previewOpenParentEmailInviteForMe();
      if (!alive || redeemSuccessRef.current) return;
      setPreview(result);
      setLoading(false);
    }

    void run();
    return () => {
      alive = false;
    };
  }, [token, user, authLoading, navigate]);

  const authNext = useMemo(() => {
    if (token && isParentInviteTokenShape(token)) {
      const path = buildParentInviteAuthNext(token);
      return isSafeAuthRedirectPath(path) ? path : '/app/parent-invite';
    }
    return '/app/parent-invite';
  }, [token]);

  const authQuery = useMemo(
    () => buildParentInviteAuthQuery({ next: authNext, email: inviteEmail }),
    [authNext, inviteEmail],
  );

  const handleConfirm = async () => {
    if (confirming || redeemSuccessRef.current) return;
    if (!token && !emailBoundMode) return;
    setConfirming(true);
    setError(null);
    const result = token
      ? await redeemParentLinkInvite(token)
      : await redeemOpenParentEmailInviteForMe();
    if (result.status !== 'linked' && result.status !== 'already_linked') {
      setError(result.message);
      setConfirming(false);
      if (result.status === 'email_mismatch' || result.status === 'email_not_verified') {
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                status: result.status as 'email_mismatch' | 'email_not_verified',
                expectedEmailMasked: result.expectedEmailMasked,
                message: result.message,
                playerDisplayName: null,
                teamLabel: null,
                seasonLabel: null,
              }
            : prev,
        );
      }
      return;
    }

    // Latch immediately so late peek/preview cannot show already_used.
    redeemSuccessRef.current = true;
    clearStashedParentInviteToken();
    clearPendingParentEmailInviteFlag();
    setPreviewRole('parent');

    // Metadata cleanup must not turn a successful link into "already used".
    try {
      await persistParentRoleChoice();
    } catch {
      /* ignore */
    }
    try {
      await clearParentLinkDeferred();
    } catch {
      /* ignore */
    }
    try {
      await clearParentInviteTokenFromUserMetadata();
    } catch {
      /* ignore */
    }
    try {
      await reloadSessionTeamSeasons(result.teamSeasonId);
    } catch {
      /* full reload below */
    }
    goHomeWithTeamSeason(result.teamSeasonId);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate(`/login?${authQuery}`, { replace: true });
  };

  const showNoInvite =
    !loading &&
    !authLoading &&
    !token &&
    !emailBoundMode &&
    !preview;

  return (
    <div className="page relative min-h-[100dvh] overflow-y-auto overscroll-y-contain px-4 pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+1rem))]">
      <div className="mx-auto max-w-[720px]">
        <Card>
          <div className="space-y-4">
            <CardTitle>Einladung annehmen</CardTitle>

            {loading || authLoading || authRoutePending ? (
              <p className="text-sm text-[var(--text-sub)]">
                {authRoutePending
                  ? accountExists
                    ? 'Weiter zur Anmeldung…'
                    : 'Weiter zur Registrierung…'
                  : 'Lade Einladung…'}
              </p>
            ) : showNoInvite ? (
              <p className="text-sm text-[var(--text-sub)]">
                Kein gültiger Einladungslink. Bitte den Link aus der E-Mail erneut öffnen oder den
                Code unter „Kind verknüpfen“ eingeben.
              </p>
            ) : error ? (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            ) : null}

            {!loading && !authLoading && !authRoutePending && preview?.status === 'needs_auth' ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-sub)]">
                  {accountExists
                    ? 'Melde dich mit der eingeladenen E-Mail an, um fortzufahren. Kinddaten erscheinen erst nach Prüfung.'
                    : 'Lege ein Konto mit der eingeladenen E-Mail an. Kinddaten erscheinen erst nach Bestätigung und Annahme.'}
                </p>
                {inviteEmail ? (
                  <p className="text-sm text-[var(--text-sub)]">
                    Diese Einladung gilt für: <span className="font-medium">{inviteEmail}</span>
                  </p>
                ) : null}
                <Link
                  to={accountExists ? `/login?${authQuery}` : `/register?${authQuery}`}
                  className="block rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  {accountExists ? 'Zur Anmeldung' : 'Zur Registrierung'}
                </Link>
              </div>
            ) : null}

            {!loading && !authLoading && preview?.status === 'email_mismatch' ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-sub)]">
                  Diese Einladung ist für eine andere E-Mail-Adresse bestimmt
                  {preview.expectedEmailMasked ? ` (${preview.expectedEmailMasked})` : ''}.
                  Kinddaten werden nicht angezeigt.
                </p>
                <Button variant="primary" className="w-full" onClick={() => void handleSignOut()}>
                  Abmelden und mit der eingeladenen E-Mail anmelden
                </Button>
              </div>
            ) : null}

            {!loading && !authLoading && preview?.status === 'email_not_verified' ? (
              <p className="text-sm text-[var(--text-sub)]">{preview.message}</p>
            ) : null}

            {!loading &&
            !authLoading &&
            preview &&
            ['invalid_token', 'expired', 'revoked', 'already_used', 'error'].includes(
              preview.status,
            ) ? (
              <p className="text-sm text-[var(--text-sub)]">{preview.message}</p>
            ) : null}

            {!loading && !authLoading && preview?.status === 'already_linked' ? (
              <div className="space-y-3">
                <p className="text-sm text-emerald-400">{preview.message}</p>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    clearStashedParentInviteToken();
                    clearPendingParentEmailInviteFlag();
                    void clearParentInviteTokenFromUserMetadata();
                    goHomeWithTeamSeason(null);
                  }}
                >
                  Zur App
                </Button>
              </div>
            ) : null}

            {!loading && !authLoading && preview?.status === 'ready' ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-sub)]">
                  Möchtest du dieses Kind mit deinem Elternkonto verknüpfen?
                </p>
                <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-3">
                  <p className="text-base font-semibold text-[var(--text-main)]">
                    {preview.playerDisplayName || 'Kind'}
                  </p>
                  {(() => {
                    const teamRaw = (preview.teamLabel ?? '').trim();
                    const seasonRaw = (preview.seasonLabel ?? '').trim();
                    const teamLooksLikeSeason =
                      Boolean(seasonRaw) &&
                      (teamRaw === seasonRaw ||
                        teamRaw.endsWith(`· ${seasonRaw}`) ||
                        teamRaw.endsWith(`- ${seasonRaw}`) ||
                        teamRaw.includes(seasonRaw));
                    const teamOnly = teamLooksLikeSeason
                      ? teamRaw
                          .replace(new RegExp(`\\s*[·\\-]\\s*${seasonRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`), '')
                          .trim() || teamRaw
                      : teamRaw;
                    return (
                      <>
                        {teamOnly ? (
                          <p className="mt-1 text-sm text-[var(--text-sub)]">{teamOnly}</p>
                        ) : null}
                        {seasonRaw ? (
                          <p className="mt-0.5 text-sm text-[var(--text-sub)]">
                            Saison {seasonRaw}
                          </p>
                        ) : null}
                      </>
                    );
                  })()}
                  {preview.expiresAt ? (
                    <p className="mt-1 text-xs text-[var(--text-sub)]">
                      Gültig bis {new Date(preview.expiresAt).toLocaleString('de-AT')}
                    </p>
                  ) : null}
                </div>
                <p className="text-sm text-[var(--text-sub)]">
                  Mit der Annahme wirst du mit{' '}
                  {preview.playerDisplayName || 'diesem Kind'} verknüpft und erhältst Zugriff auf
                  Termine, Zu- und Absagen sowie Mannschaftsinformationen.
                </p>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={confirming}
                  onClick={() => void handleConfirm()}
                >
                  {confirming ? 'Verknüpfe…' : 'Einladung annehmen'}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
};
