import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { Card, CardTitle } from '../app/components/ui/Card';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import {
  clearParentLinkDeferred,
  isParentInviteTokenShape,
  normalizeParentInviteToken,
  persistParentRoleChoice,
  redeemParentLinkInvite,
} from '../lib/parentChildLink';
import {
  buildParentInviteAuthNext,
  clearStashedParentInviteToken,
  peekParentLinkInvite,
  previewParentLinkInvite,
  readStashedParentInviteEmail,
  readStashedParentInviteToken,
  stashParentInviteEmail,
  stashParentInviteToken,
  type ParentInvitePreview,
} from '../lib/parentLinkInvites';
import { supabase } from '../lib/supabaseClient';
import { isSafeAuthRedirectPath } from '../lib/authRedirect';

const TEAM_SEASON_STORAGE_KEY = 'spielzeit_team_season_id';

function goHomeWithTeamSeason(teamSeasonId: string | null) {
  try {
    if (teamSeasonId) {
      window.localStorage.setItem(TEAM_SEASON_STORAGE_KEY, teamSeasonId);
    }
  } catch {
    /* ignore */
  }
  window.location.assign('/app/home');
}

export const ParentInviteAcceptPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { setPreviewRole } = useSession();

  const [token, setToken] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParentInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = normalizeParentInviteToken(searchParams.get('t') ?? '');
    if (isParentInviteTokenShape(fromQuery)) {
      stashParentInviteToken(fromQuery);
      setToken(fromQuery);
      navigate('/app/parent-invite', { replace: true });
      return;
    }
    const stashed = readStashedParentInviteToken();
    if (stashed && isParentInviteTokenShape(normalizeParentInviteToken(stashed))) {
      setToken(normalizeParentInviteToken(stashed));
      return;
    }
    setToken(null);
  }, [searchParams, navigate]);

  useEffect(() => {
    let alive = true;
    async function loadPeek() {
      if (!token) {
        setInviteEmail(readStashedParentInviteEmail());
        return;
      }
      const peek = await peekParentLinkInvite(token);
      if (!alive) return;
      if (peek.status === 'ready' && peek.recipientEmail) {
        stashParentInviteEmail(peek.recipientEmail);
        setInviteEmail(peek.recipientEmail);
        return;
      }
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
      }
      setInviteEmail(readStashedParentInviteEmail());
    }
    void loadPeek();
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!token) {
        setLoading(false);
        setPreview(null);
        return;
      }
      setLoading(true);
      setError(null);

      if (authLoading) {
        return;
      }

      if (!user) {
        if (!alive) return;
        setPreview((prev) =>
          prev &&
          ['invalid_token', 'expired', 'revoked', 'already_used'].includes(prev.status)
            ? prev
            : {
                status: 'needs_auth',
                playerDisplayName: null,
                teamLabel: null,
                seasonLabel: null,
                expiresAt: null,
                expectedEmailMasked: null,
                message: 'Bitte zuerst anmelden oder registrieren.',
              },
        );
        setLoading(false);
        return;
      }

      await persistParentRoleChoice();
      setPreviewRole('parent');

      const result = await previewParentLinkInvite(token);
      if (!alive) return;
      setPreview(result);
      setLoading(false);
    }

    void run();
    return () => {
      alive = false;
    };
  }, [token, user, authLoading, setPreviewRole]);

  const authNext = useMemo(() => {
    if (token && isParentInviteTokenShape(token)) {
      const path = buildParentInviteAuthNext(token);
      return isSafeAuthRedirectPath(path) ? path : '/app/parent-invite';
    }
    return '/app/parent-invite';
  }, [token]);

  const authQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('next', authNext);
    if (inviteEmail) params.set('email', inviteEmail);
    return params.toString();
  }, [authNext, inviteEmail]);

  const handleConfirm = async () => {
    if (!token || confirming) return;
    setConfirming(true);
    setError(null);
    const result = await redeemParentLinkInvite(token);
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

    await clearParentLinkDeferred();
    clearStashedParentInviteToken();
    setPreviewRole('parent');
    goHomeWithTeamSeason(result.teamSeasonId);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate(`/login?${authQuery}`, { replace: true });
  };

  return (
    <div className="page relative min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-[720px]">
        <Card>
          <div className="space-y-4">
            <CardTitle>Einladung annehmen</CardTitle>

            {loading || authLoading ? (
              <p className="text-sm text-[var(--text-sub)]">Lade Einladung…</p>
            ) : !token ? (
              <p className="text-sm text-[var(--text-sub)]">
                Kein gültiger Einladungslink. Bitte den Link aus der E-Mail erneut öffnen oder den
                Code unter „Kind verknüpfen“ eingeben.
              </p>
            ) : error ? (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            ) : null}

            {!loading && !authLoading && preview?.status === 'needs_auth' ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-sub)]">
                  Melde dich an oder registriere dich, um die Einladung fortzusetzen. Die Kinddaten
                  werden erst nach erfolgreicher Anmeldung mit der eingeladenen E-Mail geprüft.
                </p>
                {inviteEmail ? (
                  <p className="text-sm text-[var(--text-sub)]">
                    Diese Einladung gilt für: <span className="font-medium">{inviteEmail}</span>
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link
                    to={`/login?${authQuery}`}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white"
                  >
                    Anmelden
                  </Link>
                  <Link
                    to={`/register?${authQuery}`}
                    className="flex-1 rounded-xl border border-[var(--glass-border)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-main)]"
                  >
                    Registrieren
                  </Link>
                </div>
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
                  onClick={() => goHomeWithTeamSeason(null)}
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
                  {preview.teamLabel ? (
                    <p className="mt-1 text-sm text-[var(--text-sub)]">{preview.teamLabel}</p>
                  ) : null}
                  {preview.seasonLabel ? (
                    <p className="mt-0.5 text-sm text-[var(--text-sub)]">{preview.seasonLabel}</p>
                  ) : null}
                  {preview.expiresAt ? (
                    <p className="mt-1 text-xs text-[var(--text-sub)]">
                      Gültig bis {new Date(preview.expiresAt).toLocaleString('de-AT')}
                    </p>
                  ) : null}
                </div>
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
