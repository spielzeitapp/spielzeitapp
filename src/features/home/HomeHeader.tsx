import React from 'react';

const BACKEND_STAFF_LABEL_DE: Record<string, string> = {
  admin: 'Admin',
  head_coach: 'Cheftrainer',
  trainer: 'Trainer',
  co_trainer: 'Co-Trainer',
};

type HomeHeaderProps = {
  welcomeLine: string;
  teamName: string;
  /** Backend-Rolle (user_roles): nur Anzeige-Badge für Staff. */
  backendRole: string;
};

export const HomeHeader: React.FC<HomeHeaderProps> = ({ welcomeLine, teamName, backendRole }) => {
  const br = (backendRole ?? '').trim().toLowerCase();
  const isStaff = ['admin', 'head_coach', 'trainer', 'co_trainer'].includes(br);
  const staffShort = isStaff ? (BACKEND_STAFF_LABEL_DE[br] ?? 'Staff') : null;

  return (
    <header className="flex items-start justify-between gap-2 border-b border-white/[0.06] pb-2 pt-0.5">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold leading-snug text-white sm:text-lg">{welcomeLine}</h1>
        <p className="mt-0.5 truncate text-[11px] text-white/45 sm:text-xs">
          Matchday Feed · <span className="text-white/65">{teamName}</span>
        </p>
      </div>
      {staffShort ? (
        <span className="shrink-0 rounded-full border border-red-500/35 bg-red-950/45 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-200/95">
          {staffShort}
        </span>
      ) : null}
    </header>
  );
};
