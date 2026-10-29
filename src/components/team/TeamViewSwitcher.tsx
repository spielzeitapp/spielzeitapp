import React, { useState } from 'react';
import { Check, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { Modal } from '../../app/ui/Modal';
import { getClubLogo } from '../../lib/teamLogos';

/** Changes the viewed team without giving a favorite membership or editing rights. */
export function TeamViewSwitcher() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { teamSeasons, selectedTeamSeasonId, viewTeamSeasonId, setViewTeamSeasonId, setTeamViewFilter } = useSession();
  const melk = pathname.endsWith('/favorite/sc-melk');
  const base = pathname.startsWith('/demo') ? '/demo' : '/app';
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Mannschaft wechseln" title="Mannschaft wechseln" aria-haspopup="dialog" aria-expanded={open}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/65 text-[rgb(var(--club-accent-rgb))] shadow-lg backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
      <Users className="h-5 w-5" aria-hidden />
    </button>
    <Modal isOpen={open} title="Mannschaft wechseln" onClose={() => setOpen(false)}>
      <div className="space-y-2">
        {teamSeasons.filter(ts => ts.status !== 'archived').map(ts => {
          const selected = !melk && ts.id === (viewTeamSeasonId ?? selectedTeamSeasonId);
          return <button key={ts.id} type="button" aria-pressed={selected} onClick={() => {
            setTeamViewFilter(null); setViewTeamSeasonId(ts.id); setOpen(false); navigate(`${base}/team`);
          }} className={`flex min-h-[76px] w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${selected ? 'border-[rgb(var(--club-border-rgb)/0.7)] bg-[rgb(var(--club-primary-rgb)/0.22)]' : 'border-white/15 bg-white/[0.035]'}`}>
            <img src={getClubLogo(ts.team?.name || '', { teamId: ts.team?.id })} alt="" className="h-10 w-10 object-contain" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{ts.team?.name || ts.display_name} · {ts.age_group}</span><span className="text-xs text-white/60">{ts.season?.name}</span></span>
            {selected ? <Check className="h-5 w-5 text-red-400" aria-hidden /> : null}
          </button>;
        })}
        <button type="button" aria-pressed={melk} onClick={() => { setOpen(false); navigate(`${base}/team/favorite/sc-melk`); }}
          className={`flex min-h-[76px] w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${melk ? 'border-[rgb(var(--club-border-rgb)/0.7)] bg-[rgb(var(--club-primary-rgb)/0.22)]' : 'border-white/15 bg-white/[0.035]'}`}>
          <img src="https://spielzeitapp.at/demo/sc-melk/club-logo.png" alt="" className="h-10 w-10 object-contain" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">SC Melk · U16 FR</span><span className="text-xs text-white/60">2026/27 · Private Demo</span></span>
          {melk ? <Check className="h-5 w-5 text-red-400" aria-hidden /> : null}
        </button>
      </div>
    </Modal>
  </>;
}
