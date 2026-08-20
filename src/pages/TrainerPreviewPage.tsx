import React, { ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { PREVIEW_ROLE_STORAGE_KEY, useSession } from '../auth/useSession';
import { Card, CardTitle } from '../app/components/ui/Card';
import { isPlatformAdminBackendRole } from '../manager/managerWorkMode';

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

export const TrainerPreviewPage: React.FC = () => {
  const { backendRole, effectiveRole, previewRole, setPreviewRole } = useSession();

  // Nur echte Plattformadmin-Rolle aus user_roles — nie Preview/Membership.
  if (!isPlatformAdminBackendRole(backendRole)) {
    return <Navigate to="/app/mehr" replace />;
  }

  const handlePreviewRoleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const v = event.target.value;
    setPreviewRole(v === '' ? null : v);
  };

  const handleResetPreview = () => {
    setPreviewRole(null);
    try {
      window.localStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="page trainer-preview min-h-[60vh] w-full px-4 py-6"
      style={{
        background:
          'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
        boxShadow: 'inset 0 0 120px rgba(120,20,20,0.12)',
      }}
    >
      <div className="mx-auto max-w-[560px] space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Rollen-Vorschau (nur Plattformadmin)</h1>
        <p className="text-sm text-white/60">Ändert nur die Darstellung, nicht deine Berechtigungen.</p>
        <Card className="text-white shadow-lg shadow-black/20">
          <CardTitle className="text-lg">Vorschau</CardTitle>
          <p className="mt-1 text-xs text-white/55">
            Aktuelle UI-Ansicht: <span className="font-medium text-[var(--text-main)]">{effectiveRole}</span>
            {previewRole != null && (
              <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-400">
                Preview
              </span>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              id="trainer-preview-role-select"
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
        </Card>
      </div>
    </div>
  );
};
