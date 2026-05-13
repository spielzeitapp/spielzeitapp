import React from 'react';

const BACKEND_STAFF_LABEL_DE: Record<string, string> = {
  admin: 'Admin',
  head_coach: 'Cheftrainer',
  trainer: 'Trainer',
  co_trainer: 'Co-Trainer',
};

type HomeHeaderProps = {
  teamName: string;
  /** Backend-Rolle (user_roles): nur Anzeige-Badge für Staff. */
  backendRole: string;
};

export const HomeHeader: React.FC<HomeHeaderProps> = ({ teamName, backendRole }) => {
  const br = (backendRole ?? '').trim().toLowerCase();
  const isStaff = ['admin', 'head_coach', 'trainer', 'co_trainer'].includes(br);
  const staffShort = isStaff ? (BACKEND_STAFF_LABEL_DE[br] ?? 'Staff') : null;

  return (
    <header className="flex items-start justify-between gap-2 border-b border-white/[0.06] pb-2.5 pt-0.5">
      <div className="min-w-0 flex-1">
        <h1
          className="font-black italic leading-[1.05] tracking-tight"
          style={{ transform: 'skewX(-4deg)' }}
        >
          <span
            className="text-[clamp(1.35rem,5.5vw,1.65rem)] text-[#fafafa]"
            style={{
              textShadow:
                '0 1px 0 rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.65), 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            Spielzeit
          </span>
          <span
            className="text-[clamp(1.35rem,5.5vw,1.65rem)] text-[#f87171]"
            style={{
              textShadow:
                '0 1px 0 rgba(0,0,0,0.4), 0 3px 14px rgba(0,0,0,0.75), 0 0 18px rgba(220,38,38,0.18)',
            }}
          >
            App
          </span>
        </h1>
        <p className="mt-1 truncate text-[13px] font-medium text-white/72 sm:text-sm">{teamName}</p>
      </div>
      {staffShort ? (
        <span className="shrink-0 rounded-full border border-red-500/35 bg-red-950/45 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-200/95">
          {staffShort}
        </span>
      ) : null}
    </header>
  );
};
