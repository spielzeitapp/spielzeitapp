import React from 'react';
import { ChevronRight, History, LayoutTemplate, LogOut, Monitor, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { getDisplayFirstName, profileDisplayName, useProfile } from '../../auth/useProfile';
import { useSession } from '../../auth/useSession';
import { useManagerWorkMode } from '../ManagerWorkModeContext';
import { ManagerMobilePageTitle } from './ManagerMobileUi';

function MoreLink({ to, icon: Icon, title, detail }: { to: string; icon: React.ComponentType<{ className?: string }>; title: string; detail: string }): React.ReactElement {
  return <Link to={to} className="flex min-h-[72px] items-center gap-3 border-b border-white/[0.07] px-4 last:border-0"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-950/35 text-red-300"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">{title}</span><span className="mt-0.5 block truncate text-[11px] text-white/45">{detail}</span></span><ChevronRight className="h-5 w-5 text-white/25" /></Link>;
}

export function ManagerMobileMorePage(): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { signOut } = useSession();
  const { profile } = useProfile(user?.id);
  const { isTrainerMode, workMode, availableModes, setWorkMode, supportSession } = useManagerWorkMode();
  const name = getDisplayFirstName(profile) || profileDisplayName(profile) || user?.email?.split('@')[0] || 'Funktionär';

  return (
    <div className="min-h-full bg-[#050506] px-4 pb-6 pt-5 text-white">
      <ManagerMobilePageTitle eyebrow="Spielzeit Manager" title="Mehr" />
      <section className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/50 to-[#111114] p-4">
        <span className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-red-600 text-xl font-black">{name.charAt(0).toUpperCase()}</span>
        <span><span className="block text-[17px] font-black">{name}</span><span className="mt-0.5 block text-[11px] uppercase tracking-[0.16em] text-red-200/70">{workMode === 'platform_admin' ? 'Plattformadmin' : isTrainerMode ? 'Trainer' : 'Vereinsadmin'}</span></span>
      </section>

      {availableModes.length > 1 && !supportSession ? (
        <section className="mt-5 rounded-2xl border border-white/[0.09] bg-[#111114] p-4">
          <h2 className="text-[14px] font-bold">Arbeitsbereich wählen</h2>
          <p className="mt-1 text-[11px] text-white/50">Deine Berechtigungen bleiben gleich. Du wechselst nur die Manager-Ansicht.</p>
          <div className="mt-3 grid gap-2">
            {availableModes.map((mode) => {
              const label = mode === 'platform_admin' ? 'Plattformverwaltung' : mode === 'club_admin' ? 'Vereinsverwaltung' : 'Trainerbereich';
              return <button key={mode} type="button" onClick={() => setWorkMode(mode)}
                aria-current={workMode === mode ? 'page' : undefined}
                className={`min-h-11 rounded-xl border px-3 text-left text-[13px] font-semibold ${workMode === mode ? 'border-red-500 bg-red-950/40 text-white' : 'border-white/10 text-white/70'}`}>{label}{workMode === mode ? ' · aktiv' : ''}</button>;
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#111114]">
        {isTrainerMode ? <>
          <MoreLink to="/manager/training/vorlagen" icon={LayoutTemplate} title="Vorlagen" detail="Trainingspläne wiederverwenden" />
          <MoreLink to="/manager/training/chronik" icon={History} title="Trainingschronik" detail="Vergangene Einheiten" />
        </> : null}
        {workMode === 'platform_admin' && !supportSession ? <MoreLink to="/manager/vereine" icon={Shield} title="Vereine verwalten" detail="Vereine und Mannschaften einrichten" /> : null}
        {workMode === 'club_admin' || supportSession ?
          <MoreLink to="/manager/saisons" icon={Monitor} title="Vollständige Verwaltung" detail="Saisonen, Kader und ÖFB-Import im Manager" /> : null}
        <MoreLink to="/app/home" icon={ChevronRight} title="Zur SpielzeitApp" detail="Team und Termine öffnen" />
        <a href="/manager-install.html" className="flex min-h-[72px] items-center gap-3 border-b border-white/[0.07] px-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-950/35 text-red-300"><Monitor className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">Manager-Icon hinzufügen</span><span className="mt-0.5 block text-[11px] text-white/45">Eigenes Icon für den Home-Bildschirm</span></span>
          <ChevronRight className="h-5 w-5 text-white/25" />
        </a>
      </section>

      <button type="button" onClick={async () => { await signOut(); navigate('/manager/login?next=%2Fmanager%3Fentry%3Dplatform', { replace: true }); }} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white/45"><LogOut className="h-4 w-4" />Abmelden</button>
    </div>
  );
}
