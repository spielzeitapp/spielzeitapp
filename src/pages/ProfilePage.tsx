import React, { ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { useAuth } from '../auth/AuthProvider';
import { Card, CardTitle } from '../app/components/ui/Card';

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
  } = useSession();

  const showPreviewSwitch = backendRole === 'admin' || backendRole === 'head_coach';
  const selectedTeamName = getTeamName(selectedTeamSeason);
  const email = authUser?.email ?? user?.name ?? '–';

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
          <CardTitle>{email}</CardTitle>

        <p className="mt-1 text-sm text-[var(--text-sub)]">
          Backend-Rolle: <span className="font-medium text-[var(--text-main)]">{backendRole}</span>
        </p>

        <p className="mt-1 text-sm text-[var(--text-sub)]">
          UI-Ansicht: <span className="font-medium text-[var(--text-main)]">{effectiveRole}</span>
          {previewRole != null && (
            <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-400">
              Preview
            </span>
          )}
        </p>

        <p className="mt-2 text-sm text-[var(--text-sub)]">
          Team: <span className="font-medium text-[var(--text-main)]">{selectedTeamName}</span>
        </p>

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
