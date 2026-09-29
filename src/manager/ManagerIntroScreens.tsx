import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { isPlatformAdminBackendRole } from './managerWorkMode';

const MANAGER_HOME = '/manager?entry=platform';

export function ManagerSplashScreen(): React.ReactElement {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => navigate('/manager/intro/welcome', { replace: true }), 1000);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[radial-gradient(circle_at_50%_42%,#4b1018_0%,#16080c_42%,#070708_85%)] px-6 text-white">
      <div className="flex flex-col items-center text-center">
        <img src="/manager-icon-512.png" alt="" className="h-40 w-40 rounded-[2rem] shadow-[0_0_65px_rgba(220,38,38,0.25)]" />
        <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.35em] text-red-300">Willkommen im</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Spielzeit <span className="text-red-500">Manager</span></h1>
        <p className="mt-3 text-sm font-medium text-white/60">Vereine · Teams · Saisonen</p>
      </div>
    </div>
  );
}

export function ManagerWelcomeScreen(): React.ReactElement {
  const navigate = useNavigate();
  const { backendRole, loading } = useSession();
  const platformAdmin = isPlatformAdminBackendRole(backendRole);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[radial-gradient(circle_at_50%_15%,#390b13_0%,#10090d_44%,#070708_85%)] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center text-center">
        <img src="/manager-icon-512.png" alt="" className="mx-auto h-32 w-32 rounded-[1.75rem] shadow-[0_0_55px_rgba(220,38,38,0.22)]" />
        <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.3em] text-red-300">Willkommen im</p>
        <h1 className="mt-2 text-[clamp(2rem,8vw,2.8rem)] font-black leading-tight tracking-tight">Spielzeit <span className="text-red-500">Manager</span></h1>
        <p className="mt-4 text-base leading-7 text-white/65">
          {platformAdmin
            ? 'Verwalte Vereine, Mannschaften und Saisonen an einem Ort.'
            : 'Plane und verwalte deine Mannschaft an einem Ort.'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate(MANAGER_HOME, { replace: true })}
        disabled={loading}
        className="mx-auto min-h-14 w-full max-w-md rounded-2xl bg-red-700 px-5 py-3 text-base font-bold text-white shadow-[0_14px_35px_rgba(185,28,28,0.28)] hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
      >
        {loading ? 'Manager wird geladen…' : platformAdmin ? 'Plattformverwaltung öffnen' : 'Manager öffnen'}
      </button>
    </div>
  );
}
