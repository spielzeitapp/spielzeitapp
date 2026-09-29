import React from 'react';
import { Navigate } from 'react-router-dom';
import { ManagerDashboardPage } from './ManagerDashboardPage';
import { useManagerWorkMode } from './ManagerWorkModeContext';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarPlus, Dumbbell, History, LayoutTemplate, MapPinned } from 'lucide-react';

const planningLinks = [
  { to: '/manager/training/einheiten', label: 'Trainingsplanung', detail: 'Einheiten planen und bearbeiten', icon: Dumbbell },
  { to: '/manager/training/bibliothek', label: 'Übungsbibliothek', detail: 'Übungen für dein Training finden', icon: BookOpen },
  { to: '/manager/training/vorlagen', label: 'Vorlagen', detail: 'Wiederverwendbare Trainingspläne', icon: LayoutTemplate },
  { to: '/manager/training/chronik', label: 'Trainingschronik', detail: 'Vergangene Einheiten ansehen', icon: History },
  { to: '/manager/platzbelegung', label: 'Platzbelegung', detail: 'Freie Plätze und Zeiten prüfen', icon: MapPinned },
] as const;

function TrainerPlanningHome(): React.ReactElement {
  return (
    <div className="min-h-full bg-[#050506] px-4 pb-8 pt-6 text-white md:hidden">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">Trainerbereich</p>
      <h1 className="mt-2 text-2xl font-black">Training planen</h1>
      <p className="mt-2 text-sm text-white/55">Dein Arbeitsbereich für Einheiten, Übungen und Vorlagen.</p>
      <Link to="/manager/training/einheiten/neu" className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-bold text-white">
        <CalendarPlus className="h-5 w-5" aria-hidden /> Neue Trainingseinheit
      </Link>
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#111114]">
        {planningLinks.map(({ to, label, detail, icon: Icon }) => (
          <Link key={to} to={to} className="flex min-h-[76px] items-center gap-3 border-b border-white/[0.07] px-4 last:border-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-950/40 text-red-300"><Icon className="h-5 w-5" aria-hidden /></span>
            <span><span className="block text-sm font-bold">{label}</span><span className="mt-0.5 block text-xs text-white/45">{detail}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Der Manager-Einstieg führt zur tatsächlich gewählten Arbeitsansicht. */
export function ManagerHomeRoute(): React.ReactElement {
  const { workMode, supportSession } = useManagerWorkMode();
  if (workMode === 'platform_admin' && !supportSession) return <Navigate to="/manager/plattform" replace />;
  if (workMode === 'club_admin') return <Navigate to="/manager/saisons" replace />;
  if (workMode === 'trainer') return <><TrainerPlanningHome /><div className="hidden md:block"><ManagerDashboardPage /></div></>;
  return <ManagerDashboardPage />;
}
