import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardList, ShieldCheck } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { isPlatformAdminBackendRole } from './managerWorkMode';

const MANAGER_HOME = '/manager?entry=platform';

function ManagerIntroBackdrop(): React.ReactElement {
  return <>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(170,18,30,0.30),transparent_55%),linear-gradient(155deg,#180408_0%,#080809_58%,#100407_100%)]" aria-hidden />
    <div className="pointer-events-none absolute -left-20 top-[14%] h-2 w-[65%] -rotate-45 bg-gradient-to-r from-transparent via-red-600/40 to-transparent" aria-hidden />
    <div className="pointer-events-none absolute -right-24 bottom-[18%] h-2 w-[70%] -rotate-45 bg-gradient-to-r from-transparent via-red-700/35 to-transparent" aria-hidden />
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(120deg,transparent_49.5%,rgba(255,45,45,0.15)_50%,transparent_50.5%)] [background-size:84px_84px]" aria-hidden />
  </>;
}

export function ManagerSplashScreen(): React.ReactElement {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => navigate('/manager/intro/welcome', { replace: true }), 1000);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-[100] flex justify-center overflow-hidden bg-black text-white">
      <div className="relative flex h-full w-full max-w-md items-center justify-center overflow-hidden">
        <ManagerIntroBackdrop />
        <div className="relative z-10 flex -translate-y-[4vh] flex-col items-center px-4 text-center">
          <img src="/manager-icon-512.png" alt="" className="h-44 w-44 rounded-[2rem] shadow-[0_0_65px_rgba(220,38,38,0.3)]" />
          <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.3em] text-red-300">Dein Platz für Planung</p>
          <h1 className="mt-2 text-[clamp(2rem,8vw,2.7rem)] font-black tracking-tight">Spielzeit <span className="text-red-500">Manager</span></h1>
          <p className="mt-3 text-sm font-medium text-white/65">Planen. Organisieren. Gemeinsam gewinnen.</p>
        </div>
      </div>
    </div>
  );
}

export function ManagerWelcomeScreen(): React.ReactElement {
  const navigate = useNavigate();
  const { backendRole, loading } = useSession();
  const platformAdmin = isPlatformAdminBackendRole(backendRole);

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-black text-white">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <ManagerIntroBackdrop />
        <div className="relative z-10 flex flex-1 flex-col justify-center py-8 text-center">
          <img src="/manager-icon-512.png" alt="" className="mx-auto h-28 w-28 rounded-[1.5rem] shadow-[0_0_55px_rgba(220,38,38,0.25)]" />
          <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.25em] text-red-300">Willkommen im</p>
          <h1 className="mt-2 text-[clamp(2rem,8vw,2.7rem)] font-black leading-tight tracking-tight">Spielzeit <span className="text-red-500">Manager</span></h1>
          <p className="mx-auto mt-3 max-w-[19rem] text-[14px] leading-6 text-white/65">
            {platformAdmin ? 'Deine Vereine. Deine Teams. Alles im Blick.' : 'Deine Trainingseinheiten. Deine Übungen. Ein Plan.'}
          </p>
          <div className="mt-8 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Planung', icon: CalendarDays },
              { label: 'Teams', icon: ClipboardList },
              { label: 'Verwaltung', icon: ShieldCheck },
            ].map(({ label, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.05] px-2 py-4"><Icon className="mx-auto h-5 w-5 text-red-400" aria-hidden /><span className="mt-2 block text-[11px] font-semibold text-white/75">{label}</span></div>)}
          </div>
        </div>
      <button
        type="button"
        onClick={() => navigate(MANAGER_HOME, { replace: true })}
        disabled={loading}
        className="relative z-10 min-h-14 w-full rounded-2xl bg-red-600 px-5 py-3 text-[15px] font-bold text-white shadow-[0_14px_35px_rgba(185,28,28,0.28)] hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
      >
        {loading ? 'Manager wird geladen…' : platformAdmin ? 'Plattformverwaltung öffnen' : 'Manager öffnen'}
      </button>
      </div>
    </div>
  );
}
