import React from 'react';
import { useSession } from '../../auth/useSession';

/** Nur diese Keys; Head Coach / Co-Trainer entfernt (nur noch trainer). */
const BACKEND_ROLES = ['fan', 'parent', 'player', 'trainer', 'admin'] as const;

/** UI-Labels deutsch; value im Select bleibt der Key. */
const ROLE_LABEL_DE: Record<string, string> = {
  fan: 'Fan',
  parent: 'Eltern',
  player: 'Spieler',
  trainer: 'Trainer',
  admin: 'Admin',
};

export const RoleSwitcherDev: React.FC = () => {
  const { role, setRole } = useSession();
  const currentRole = BACKEND_ROLES.includes(role as (typeof BACKEND_ROLES)[number]) ? role : 'parent';

  return (
    <select
      value={currentRole}
      onChange={(e) => {
        const key = e.target.value;
        setRole(key as (typeof BACKEND_ROLES)[number]);
      }}
      title="Dev: Rolle wechseln"
      className="inline-flex appearance-none rounded-full border border-[var(--border)] bg-slate-900/70 px-2.5 py-1 text-[0.7rem] text-[var(--muted)] shadow-sm hover:bg-slate-800/90"
    >
      {BACKEND_ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL_DE[r] ?? r}
        </option>
      ))}
    </select>
  );
};
