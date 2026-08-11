import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { Card, CardTitle } from '../app/components/ui/Card';
import { useSession } from '../auth/useSession';
import {
  clearParentLinkDeferred,
  isParentInviteTokenShape,
  normalizeParentInviteToken,
  persistParentRoleChoice,
  redeemParentLinkInvite,
} from '../lib/parentChildLink';
import {
  clearStashedParentInviteToken,
  previewParentLinkInvite,
  readStashedParentInviteToken,
  stashParentInviteToken,
  type ParentInvitePreview,
} from '../lib/parentLinkInvites';
import { supabase } from '../lib/supabaseClient';
import { isSafeAuthRedirectPath } from '../lib/authRedirect';

function buildAuthNext(path: string): string {
  return isSafeAuthRedirectPath(path) ? path : '/app/parent-invite';
}

export const ParentInviteAcceptPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setPreviewRole } = useSession();

  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParentInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = normalizeParentInviteToken(searchParams.get('t') ?? '');
    if (isParentInviteTokenShape(fromQuery)) {
      stashParentInviteToken(fromQuery);
      setToken(fromQuery);
      // Remove token from visible URL after stashing
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

    async function run() {
      if (!token) {
        setLoading(false);
        setPreview(null);
        return;
      }
      setLoading(true);
      setError(null);

      if (!user) {
        if (!alive) return;
        setPreview({
          status: 'needs_auth',
          playerDisplayName: null,
          teamLabel: null,
          expiresAt: null,
          expectedEmailMasked: null,
          message: 'Bitte zuerst anmelden oder registrieren.',
        });
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
  }, [token, user, setPreviewRole]);

  const handleConfirm = async () => {
    if (!token) return;
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
                status: result.status,
                expectedEmailMasked: result.expectedEmailMasked,
                message: result.message,
                playerDisplayName: null,
                teamLabel: null,
              }
            : prev,
        );
      }
      return;
    }

    await clearParentLinkDeferred();
    clearStashedParentInviteToken();
    setPreviewRole('parent');
    setConfirming(false);
    navigate('/app/home', { replace: true });
    window.location.reload();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate(
      `/login?next=${encodeURIComponent(buildAuthNext('/app/parent-invite'))}`,
      { replace: true },
    );
  };

  const nextParam = encodeURIComponent(buildAuthNext('/app/parent-invite'));

  return (
    <div className="page relative min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-[720px]">
        <Card>
          <div className="space-y-4">
            <CardTitle>Einladung annehmen</CardTitle>

            {loading ? (
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

            {!loading && preview?.status === 'needs_auth' ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-sub)]">
                  Melde dich an oder registriere dich, um die Einladung fortzusetzen. Die
                  Kinddaten werden erst nach erfolgreicher Anmeldung geprüft.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link
                    to={`/login?next=${nextParam}`}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white"
                  >
                    Anmelden
                  </Link>
                  <Link
                    to={`/register?next=${nextParam}`}
                    className="flex-1 rounded-xl border border-[var(--glass-border)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-main)]"
                  >
                    Registrieren
                  </Link>
                </div>
              </div>
            ) : null}

            {!loading && preview?.status === 'email_mismatch' ? (
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

            {!loading && preview?.status === 'email_not_verified' ? (
              <p className="text-sm text-[var(--text-sub)]">{preview.message}</p>
            ) : null}

            {!loading &&
            preview &&
            ['invalid_token', 'expired', 'revoked', 'already_used', 'error'].includes(
              preview.status,
            ) ? (
              <p className="text-sm text-[var(--text-sub)]">{preview.message}</p>
            ) : null}

            {!loading && preview?.status === 'already_linked' ? (
              <div className="space-y-3">
                <p className="text-sm text-emerald-400">{preview.message}</p>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => navigate('/app/home', { replace: true })}
                >
                  Zur App
                </Button>
              </div>
            ) : null}

            {!loading && preview?.status === 'ready' ? (
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
                  {confirming ? 'Verknüpfe…' : 'Verknüpfung bestätigen'}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
};
