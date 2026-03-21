import React, { ChangeEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { useAuth } from '../auth/AuthProvider';
import { useProfile, displayName } from '../auth/useProfile';
import { supabase } from '../lib/supabaseClient';
import { Card, CardTitle } from '../app/components/ui/Card';
import { PushNotificationsButton } from '../components/PushNotificationsButton';

const PREVIEW_ROLE_OPTIONS = ['fan', 'parent', 'player', 'trainer', 'co_trainer', 'head_coach', 'admin'] as const;

const ROLE_LABELS: Record<string, string> = {
  fan: 'Fan',
  parent: 'Parent',
  player: 'Player',
  trainer: 'Trainer',
  co_trainer: 'Co-Trainer',
  head_coach: 'Head Coach',
  admin: 'Admin',
};

/** Sichere Team-Namen-Extraktion (Supabase kann team als Objekt oder Array liefern). */
function getTeamName(ts: { team?: { name?: string } | Array<{ name?: string }> } | null | undefined): string {
  if (!ts?.team) return '–';
  const t = ts.team;
  const name = Array.isArray(t) ? t[0]?.name : (t as { name?: string })?.name;
  return name ?? '–';
}

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const {
    user,
    backendRole,
    effectiveRole,
    previewRole,
    setPreviewRole,
    selectedTeamSeason,
    signOut,
    hasPendingPlayerRequest,
  } = useSession();

  const [linkedChildren, setLinkedChildren] = useState<string[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [childrenError, setChildrenError] = useState<string | null>(null);

  const { profile } = useProfile(authUser?.id);
  const showPreviewSwitch = backendRole === 'admin' || backendRole === 'head_coach';
  const selectedTeamName = getTeamName(selectedTeamSeason);
  const email = authUser?.email ?? user?.name ?? '–';
  const displayNameStr = displayName(profile, authUser?.email ?? undefined);

  useEffect(() => {
    // Nur für eingeloggte User; bevorzugt Parent-Rolle.
    if (!authUser) {
      setLinkedChildren([]);
      setChildrenError(null);
      return;
    }

    let cancelled = false;
    async function loadChildren() {
      setChildrenLoading(true);
      setChildrenError(null);

      try {
        const { data: guardianRows, error: guardianError } = await supabase
          .from('player_guardians')
          .select('player_id')
          .eq('user_id', authUser.id);

        console.log('[PROFILE CHILDREN GUARDIANS]', { data: guardianRows, error: guardianError });

        if (cancelled) return;

        if (guardianError) {
          setLinkedChildren([]);
          setChildrenError(guardianError.message ?? 'Kind-Verknüpfungen konnten nicht geladen werden.');
          setChildrenLoading(false);
          return;
        }

        const playerIds = Array.from(
          new Set((guardianRows ?? []).map((row: any) => row.player_id).filter(Boolean)),
        );

        if (playerIds.length === 0) {
          setLinkedChildren([]);
          setChildrenLoading(false);
          return;
        }

        const { data: playerRows, error: playerError } = await supabase
          .from('players')
          .select('id, first_name, last_name')
          .in('id', playerIds);

        console.log('[PROFILE CHILDREN PLAYERS]', { data: playerRows, error: playerError });

        if (cancelled) return;

        if (playerError) {
          setLinkedChildren([]);
          setChildrenError(playerError.message ?? 'Spielerdaten konnten nicht geladen werden.');
          setChildrenLoading(false);
          return;
        }

        const names = (playerRows ?? []).map((row: any) => {
          const first = (row.first_name ?? '').toString().trim();
          const last = (row.last_name ?? '').toString().trim();
          const label = `${first} ${last}`.trim() || 'Spieler';
          return label;
        });

        setLinkedChildren(names);
        setChildrenLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        console.error('[PROFILE CHILDREN LOAD ERROR]', e);
        setLinkedChildren([]);
        setChildrenError(e?.message ?? 'Kind-Verknüpfungen konnten nicht geladen werden.');
        setChildrenLoading(false);
      }
    }

    loadChildren();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  const handlePreviewRoleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const v = event.target.value;
    setPreviewRole(v === '' ? null : v);
  };

  const handleResetPreview = () => {
    setPreviewRole(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div
      className="page profile-page relative min-h-[60vh] w-full px-4 py-6"
      style={{
        background: 'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
        boxShadow: 'inset 0 0 120px rgba(120,20,20,0.12)',
      }}
    >
      <div className="mx-auto max-w-[480px] space-y-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">Profil</h1>
        <Card className="text-white">
          <CardTitle>{displayNameStr !== '–' ? displayNameStr : email}</CardTitle>
          <p className="mt-1 text-sm text-[var(--text-sub)]">
            E-Mail: <span className="font-medium text-[var(--text-main)]">{email}</span>
          </p>

        <p className="mt-1 text-sm text-[var(--text-sub)]">
          Backend-Rolle: <span className="font-medium text-[var(--text-main)]">{backendRole}</span>
        </p>

        <p className="mt-1 text-sm text-[var(--text-sub)]">
          UI-Ansicht: <span className="font-medium text-[var(--text-main)]">{effectiveRole}</span>
          {previewRole != null && previewRole !== backendRole && (
            <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-400">
              Preview
            </span>
          )}
        </p>

        {hasPendingPlayerRequest && effectiveRole === 'fan' && (
          <p className="mt-1 text-xs text-amber-300">
            Deine Spieleranfrage wurde an den Trainer gesendet. Du erhältst Spielerzugriff, sobald sie bestätigt wurde.
          </p>
        )}

        <p className="mt-2 text-sm text-[var(--text-sub)]">
          Team: <span className="font-medium text-[var(--text-main)]">{selectedTeamName}</span>
        </p>

        {effectiveRole === 'parent' && (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="mb-2 text-xs font-medium text-[var(--text-sub)]">
              Browser-Benachrichtigungen
            </div>
            <PushNotificationsButton />
          </div>
        )}

        {effectiveRole === 'parent' && (
          <div className="mt-2 text-sm text-[var(--text-sub)]">
            <div className="font-medium text-[var(--text-main)]">Verknüpfte Kinder</div>
            {childrenLoading ? (
              <p className="mt-0.5 text-xs text-[var(--text-sub)]">Lade Kind-Verknüpfung…</p>
            ) : childrenError ? (
              <p className="mt-0.5 text-xs text-red-400">{childrenError}</p>
            ) : linkedChildren.length === 0 ? (
              <p className="mt-0.5 text-xs text-[var(--text-sub)]">Kein Kind verknüpft.</p>
            ) : (
              <ul className="mt-0.5 list-disc pl-4 text-xs text-[var(--text-main)]">
                {linkedChildren.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {showPreviewSwitch && (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
            <label className="block text-xs font-medium text-[var(--text-sub)]" htmlFor="preview-role-select">
              Ansicht testen als
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <select
                id="preview-role-select"
                value={previewRole ?? ''}
                onChange={handlePreviewRoleChange}
                className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-black/40 px-2 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              >
                <option value="">— Backend-Rolle —</option>
                {PREVIEW_ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] ?? r}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleResetPreview}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-medium text-[var(--text-main)] hover:bg-white/10"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-[var(--text-sub)]">
          Später kannst du hier Kontaktinformationen, Benachrichtigungen und verknüpfte Kinder verwalten.
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 w-full rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black"
        >
          Abmelden
        </button>

        {import.meta.env.DEV && (
          <p className="mt-3 text-xs">
            <Link to="/admin/setup" className="text-[var(--primary)] hover:underline">
              Admin Setup
            </Link>
          </p>
        )}
        </Card>
      </div>
    </div>
  );
};
