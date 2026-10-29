import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageShell, PremiumCard, PremiumTab, PremiumTabTrack } from '../ui';
import { TeamViewSwitcher } from '../components/team/TeamViewSwitcher';

const tabs = ['Kader', 'Trainer', 'Training', 'Spiele'] as const;
/** Read-only pilot: no own-team data or staff permissions are used here. */
export function MelkFavoritePreview(): React.ReactElement {
  const [tab, setTab] = useState<typeof tabs[number]>('Kader');
  const { pathname } = useLocation();
  const base = pathname.startsWith('/demo') ? '/demo' : '/app';
  return <PageShell variant="subtle" showAtmosphere={false}
    className="page team-page min-h-[60vh] w-full max-w-none min-w-0 overflow-x-hidden px-0 pb-36 sm:px-4 md:px-0"
    contentClassName="mx-auto w-full min-w-0 max-w-none space-y-3 md:max-w-3xl lg:max-w-4xl">
    <PremiumCard matchday showAmbientGlow className="!rounded-none !border-x-0 !p-0 overflow-hidden sm:!rounded-3xl sm:!border-x">
      <div className="relative h-[220px] sm:aspect-[16/9] sm:h-auto sm:min-h-[280px] sm:max-h-[390px]">
        <img src="https://spielzeitapp.at/demo/sc-melk/team-hero.jpg" alt="Fiktives SC-Melk-Demo-Mannschaftsbild" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute left-3 top-3"><TeamViewSwitcher /></div>
        <span className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/65 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/80">Private Demo</span>
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 sm:p-6">
          <img src="https://spielzeitapp.at/demo/sc-melk/club-logo.png" alt="SC Melk Wappen" className="h-[68px] w-[68px] shrink-0 object-contain" />
          <div className="min-w-0 pb-1"><h1 className="text-[27px] font-black uppercase leading-none text-white sm:text-[34px]">SC Melk</h1><p className="mt-2 text-[13px] font-black uppercase tracking-widest text-white/80"><span className="sz-club-accent-text">U16 FR</span> · Saison 2026/27</p></div>
        </div>
      </div>
    </PremiumCard>
    <div className="px-3"><PremiumTabTrack>{tabs.map(label => <PremiumTab key={label} active={tab === label} role="tab" aria-selected={tab === label} onClick={() => setTab(label)}>{label}</PremiumTab>)}</PremiumTabTrack></div>
    <div className="px-3" role="tabpanel" aria-label={tab}>
      <p className="mb-3 text-xs leading-relaxed text-white/55">Private Vorschau mit fiktiven Spielerinnen.</p>
      {tab === 'Kader' ? <>
        <h2 className="mb-3 text-xl font-black uppercase text-white">Unser Team <span className="ml-2 text-xs font-semibold text-white/50">Demo-Kader</span></h2>
        <div className="grid grid-cols-2 gap-3">
          {[{ name: 'Lena Krammer', image: 'player-a.webp', number: 8 }, { name: 'Julia Aigner', image: 'player-b.webp', number: 10 }].map(player => <PremiumCard key={player.name} matchday className="!p-0 overflow-hidden">
            <div className="relative"><img src={`https://spielzeitapp.at/demo/sc-melk/${player.image}`} alt={`Fiktives Demo-Porträt ${player.name}`} className="aspect-[3/4] w-full object-cover" />
              <span className="absolute left-3 top-2 text-4xl font-black text-white/90">{player.number}</span>
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-4 pt-10 text-sm font-black uppercase text-white">{player.name}</p>
            </div>
          </PremiumCard>)}
        </div>
      </> : <PremiumCard variant="subtle"><h2 className="text-lg font-bold text-white">{tab}</h2><p className="mt-2 text-sm text-white/60">Für diese Demo sind noch keine {tab === 'Trainer' ? 'Trainerprofile' : tab === 'Training' ? 'Trainings' : 'Spiele'} hinterlegt.</p></PremiumCard>}
      <Link to={`${base}/team`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-bold text-white"><ArrowLeft className="h-4 w-4" aria-hidden /> Zurück zu meinem Team</Link>
    </div>
  </PageShell>;
}
