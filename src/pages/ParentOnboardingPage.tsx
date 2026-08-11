import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../app/components/ui/Button';
import { Card, CardTitle } from '../app/components/ui/Card';
import { useSession } from '../auth/useSession';
import {
  clearParentLinkDeferred,
  isParentInviteTokenShape,
  listMyLinkedChildren,
  normalizeParentInviteToken,
  persistParentRoleChoice,
  redeemParentLinkInvite,
  setParentLinkDeferred,
  userHasPlayerGuardian,
  type LinkedChildOption,
} from '../lib/parentChildLink';

function isLinkMode(
  searchParams: URLSearchParams,
  locationState: unknown,
): boolean {
  if (searchParams.get('mode') === 'link') return true;
  if (
    locationState &&
    typeof locationState === 'object' &&
    'mode' in locationState &&
    (locationState as { mode?: unknown }).mode === 'link'
  ) {
    return true;
  }
  return false;
}

export const ParentOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setPreviewRole } = useSession();
  const linkMode = isLinkMode(searchParams, location.state);

  const [userId, setUserId] = useState<string | null>(null);
  const [linkedChildren, setLinkedChildren] = useState<LinkedChildOption[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deferring, setDeferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successHint, setSuccessHint] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      setLoadError(null);
      setSuccessHint(null);

      const { data: userRes, error: authError } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;

      if (!alive) return;

      if (authError || !user) {
        const msg = authError?.message ?? 'Kein Benutzer angemeldet.';
        setError(msg);
        setLoadError(msg);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const rolePersist = await persistParentRoleChoice();
      if (!alive) return;
      if (rolePersist.error) {
        setError(rolePersist.error);
        setLoadError(rolePersist.error);
        setLoading(false);
        return;
      }
      setPreviewRole('parent');

      const { hasGuardian, error: guardianError } = await userHasPlayerGuardian(user.id);
      if (!alive) return;

      if (guardianError) {
        console.warn('[PARENT ONBOARDING] Guardian-Check fehlgeschlagen', guardianError);
        setError(guardianError);
        setLoadError(guardianError);
        setLoading(false);
        return;
      }

      if (hasGuardian && !linkMode) {
        navigate('/app/home', { replace: true });
        return;
      }

      const linked = await listMyLinkedChildren();
      if (!alive) return;
      if (linked.error) {
        console.warn('[PARENT ONBOARDING] linked children', linked.error);
      }
      setLinkedChildren(linked.data);
      setLoading(false);
    }

    load().catch((e) => {
      if (!alive) return;
      const msg = e?.message ?? 'Unbekannter Fehler beim Laden.';
      setError(msg);
      setLoadError(msg);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [navigate, linkMode, setPreviewRole]);

  const goHomeAndReload = () => {
    navigate('/app/home', { replace: true });
    window.location.reload();
  };

  const handleDefer = async () => {
    setDeferring(true);
    setError(null);

    const { error: roleError } = await persistParentRoleChoice();
    if (roleError) {
      setError(roleError);
      setDeferring(false);
      return;
    }

    const { error: deferError } = await setParentLinkDeferred(true);
    if (deferError) {
      setError(deferError);
      setDeferring(false);
      return;
    }

    setPreviewRole('parent');
    goHomeAndReload();
  };

  const handleRedeem = async () => {
    if (!userId) {
      setError('Kein Benutzer angemeldet.');
      return;
    }

    const token = normalizeParentInviteToken(inviteCode);
    if (!isParentInviteTokenShape(token)) {
      setError('Bitte den vollständigen Einladungscode vom Trainer eingeben.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessHint(null);

    const result = await redeemParentLinkInvite(token);
    if (result.status !== 'linked' && result.status !== 'already_linked') {
      setError(result.message ?? 'Verknüpfung fehlgeschlagen.');
      setSaving(false);
      return;
    }

    await clearParentLinkDeferred();
    setPreviewRole('parent');
    setSuccessHint(result.message);
    setSaving(false);
    goHomeAndReload();
  };

  if (loading) {
    return (
      <div className="page relative min-h-[60vh] px-4 pt-6">
        <div className="mx-auto max-w-[720px]">
          <Card>
            <div className="space-y-4">
              <CardTitle>Kind verknüpfen</CardTitle>
              <p className="text-sm text-[var(--text-sub)]">Lade…</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page relative min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-[720px]">
        <Card>
          <div className="space-y-4">
            <CardTitle>Kind verknüpfen</CardTitle>
            <p className="text-sm text-[var(--text-sub)]">
              {linkMode
                ? 'Verknüpfe ein weiteres Kind mit dem Einladungscode vom Trainer.'
                : 'Verknüpfe dein Kind mit dem Einladungscode vom Trainer.'}
            </p>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}
            {successHint && (
              <p className="text-sm text-emerald-400" role="status">
                {successHint}
              </p>
            )}

            {loadError ? (
              <div className="space-y-3">
                <p className="text-sm text-red-400">
                  Es gab ein Problem beim Laden der Onboarding-Daten.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => window.location.reload()}
                  >
                    Erneut laden
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={async () => {
                      try {
                        await supabase.auth.signOut();
                        navigate('/login', { replace: true });
                      } catch (e) {
                        console.error('[PARENT ONBOARDING] Abmelden fehlgeschlagen', e);
                      }
                    }}
                  >
                    Abmelden
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {linkedChildren.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--text-main)]">Bereits verknüpft</p>
                    <ul className="space-y-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2">
                      {linkedChildren.map((child) => (
                        <li key={child.playerId} className="text-sm text-[var(--text-main)]">
                          {child.displayName}
                          {child.teamLabel ? (
                            <span className="text-[var(--text-sub)]"> · {child.teamLabel}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-sub)]">
                    Noch kein Kind verknüpft. Den Code erhältst du vom Trainer — es gibt keine
                    freie Spielersuche.
                  </p>
                )}

                <div className="space-y-2">
                  <label
                    htmlFor="parent-invite-code"
                    className="block text-sm font-medium text-[var(--text-main)]"
                  >
                    Einladungscode
                  </label>
                  <input
                    id="parent-invite-code"
                    type="text"
                    inputMode="text"
                    autoComplete="one-time-code"
                    spellCheck={false}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Code vom Trainer"
                    className="h-12 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 text-[var(--text-main)] placeholder:text-[var(--text-sub)] focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                  <p className="text-xs text-[var(--text-sub)]">
                    Der Code ist einmalig und vom Spielerzugang (Code/PIN/QR) getrennt.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => void handleRedeem()}
                    disabled={saving || deferring || !inviteCode.trim()}
                  >
                    {saving ? 'Verknüpfe…' : 'Mit Code verknüpfen'}
                  </Button>
                </div>

                <div className="pt-2">
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => void handleDefer()}
                    disabled={saving || deferring}
                  >
                    {deferring ? 'Weiter…' : 'Später verknüpfen'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
