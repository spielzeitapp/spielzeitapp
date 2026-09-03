import React from 'react';
import { ArrowLeftRight, Bell, ChevronRight, LogOut, Monitor, PlayCircle, UserRound } from 'lucide-react';
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
  const { canSwitchMode, isTrainerMode, switchToAdministration, switchToTrainer, adminSwitchButtonLabel } = useManagerWorkMode();
  const name = getDisplayFirstName(profile) || profileDisplayName(profile) || user?.email?.split('@')[0] || 'Funktionär';

  return (
    <div className="min-h-full bg-[#050506] px-4 pb-6 pt-5 text-white">
      <ManagerMobilePageTitle eyebrow="Manager" title="Mehr" />
      <section className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/50 to-[#111114] p-4">
        <span className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-red-600 text-xl font-black">{name.charAt(0).toUpperCase()}</span>
        <span><span className="block text-[17px] font-black">{name}</span><span className="mt-0.5 block text-[11px] uppercase tracking-[0.16em] text-red-200/70">{isTrainerMode ? 'Trainer' : 'Vereinsfunktionär'}</span></span>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#111114]">
        <MoreLink to="/app/profile" icon={UserRound} title="Profil" detail="Persönliche Daten und Konto" />
        <MoreLink to="/app/nachrichten" icon={Bell} title="Benachrichtigungen" detail="Hinweise und offene Änderungen" />
        <MoreLink to="/demo/intro/welcome" icon={PlayCircle} title="SpielzeitApp Demo" detail="Die vollständige Team-App ansehen" />
        <MoreLink to="/manager/saisons" icon={Monitor} title="Vollständiger Manager" detail="Alle Funktionen am Desktop" />
      </section>

      {canSwitchMode ? <button type="button" onClick={() => isTrainerMode ? switchToAdministration() : switchToTrainer()} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-[13px] font-bold text-white/75"><ArrowLeftRight className="h-4 w-4 text-red-300" />{isTrainerMode ? adminSwitchButtonLabel : 'Als Trainer arbeiten'}</button> : null}
      <button type="button" onClick={async () => { await signOut(); navigate('/login', { replace: true }); }} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white/45"><LogOut className="h-4 w-4" />Abmelden</button>
    </div>
  );
}
