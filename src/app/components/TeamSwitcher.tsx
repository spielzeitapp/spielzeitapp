import React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Star, ExternalLink, Trash2, Search } from 'lucide-react';
import { lockAppMainScroll } from '../../lib/bodyScrollLock';
import { getClubLogo } from '../../lib/teamLogos';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import type { SessionTeamSeasonItem } from '../../auth/useSession';
import {
  formatTeamSeasonContextLabel,
  isSeasonActive,
  resolveTeamSeasonSwitcherAction,
} from '../../lib/seasonLifecycle';

function seasonLabel(ts: SessionTeamSeasonItem): string {
  return [ts.season?.name, isSeasonActive(ts.status) ? 'Aktuell' : ts.status === 'draft' ? 'In Vorbereitung' : 'Archiv'].filter(Boolean).join(' · ');
}

function compactLabel(ts: SessionTeamSeasonItem | undefined): string {
  return ts ? formatTeamSeasonContextLabel({ displayName: ts.display_name, ageGroup: ts.age_group, teamName: ts.team?.name, seasonName: ts.season?.name, status: ts.status }, { markArchived: true }) : 'Mannschaft wählen';
}

export type TeamSwitcherProps = {
  compact?: boolean;
  className?: string;
  hideWhenSingle?: boolean;
};

/** Single work season stays separate from the read-only multi-team overview. */
export const TeamSwitcher: React.FC<TeamSwitcherProps> = ({ compact = false, className, hideWhenSingle = false }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    user, teamSeasons, selectedTeamSeasonId, setSelectedTeamSeasonId,
    viewTeamSeasonId, setViewTeamSeasonId,
    teamViewFilter, setTeamViewFilter, filteredTeamSeasonIds,
  } = useSession();
  const overview = pathname === '/app' || pathname === '/app/home' || pathname === '/app/termine' || pathname === '/app/tabelle';
  const [open, setOpen] = React.useState(false);
  const [teamSearch, setTeamSearch] = React.useState('');
  const [externalFavorites, setExternalFavorites] = React.useState<Array<{ name: string; url: string }>>([]);
  const [addingFavorite, setAddingFavorite] = React.useState(false);
  const [favoriteName, setFavoriteName] = React.useState('');
  const [favoriteUrl, setFavoriteUrl] = React.useState('');
  const [favoriteError, setFavoriteError] = React.useState('');
  const favoriteStorageKey = user?.id ? `spz_external_oefb_favorites_${user.id}` : null;
  React.useEffect(() => {
    setExternalFavorites([]);
    if (!favoriteStorageKey) return;
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(favoriteStorageKey) || '[]');
      if (Array.isArray(parsed)) setExternalFavorites(parsed.filter((v): v is { name: string; url: string } =>
        !!v && typeof v.name === 'string' && typeof v.url === 'string' && /^https:\/\/(?:www\.)?(?:oefb\.at|vereine\.oefb\.at)\//i.test(v.url)
      ).slice(0, 30));
    } catch { /* Invalid old preference: ignore. */ }
  }, [favoriteStorageKey]);
  const saveFavorites = (next: Array<{ name: string; url: string }>) => {
    setExternalFavorites(next);
    if (favoriteStorageKey) try { window.localStorage.setItem(favoriteStorageKey, JSON.stringify(next)); } catch { /* storage disabled */ }
  };
  const addExternalFavorite = () => {
    const name = favoriteName.trim();
    let url: URL;
    try { url = new URL(favoriteUrl.trim()); } catch { setFavoriteError('Bitte einen vollständigen ÖFB-Link eingeben.'); return; }
    if (!name || url.protocol !== 'https:' || !['oefb.at', 'www.oefb.at', 'vereine.oefb.at'].includes(url.hostname.toLowerCase())) {
      setFavoriteError('Bitte Mannschaftsname und offiziellen HTTPS-ÖFB-Link angeben.');
      return;
    }
    if (externalFavorites.some(item => item.url === url.href)) { setFavoriteError('Diese Mannschaft ist bereits gespeichert.'); return; }
    saveFavorites([...externalFavorites, { name, url: url.href }]);
    setFavoriteName(''); setFavoriteUrl(''); setFavoriteError(''); setAddingFavorite(false);
  };
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();
  const value = viewTeamSeasonId ?? selectedTeamSeasonId;
  const current = teamSeasons.find((ts) => ts.id === value);
  const currentSeasons = teamSeasons.filter((ts) => isSeasonActive(ts.status));
  const otherSeasons = teamSeasons.filter((ts) => !isSeasonActive(ts.status));
  const multipleAvailable = overview && currentSeasons.length > 1;
  const filtered = overview && teamViewFilter !== null;
  const triggerLabel = filtered
    ? teamViewFilter === 'all' && currentSeasons.length > 3 ? 'Alle Mannschaften' : filteredTeamSeasonIds.length <= 3
      ? currentSeasons.filter(ts => filteredTeamSeasonIds.includes(ts.id)).map(ts => ts.age_group || ts.team?.name || 'Team').join(' + ')
      : `${filteredTeamSeasonIds.length} Mannschaften`
    : formatTeamSeasonContextLabel({ displayName: (current ?? teamSeasons[0])?.display_name, ageGroup: (current ?? teamSeasons[0])?.age_group, teamName: (current ?? teamSeasons[0])?.team?.name, seasonName: (current ?? teamSeasons[0])?.season?.name }, { includeSeason: false });
  const triggerSubtitle = filtered ? 'Gemeinsame Übersicht' : [current?.season?.name, current?.status === 'archived' ? 'Archiv' : current?.status === 'draft' ? 'In Vorbereitung' : null].filter(Boolean).join(' · ');

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const unlock = lockAppMainScroll();
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === 'Tab') {
        const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        const outside = !panelRef.current?.contains(document.activeElement);
        if (event.shiftKey && (document.activeElement === first || outside)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || outside)) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keydown);
    panelRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', keydown);
      unlock();
      triggerRef.current?.focus();
    };
  }, [open]);

  const selectSingle = (ts: SessionTeamSeasonItem) => {
    setTeamViewFilter(null);
    if (resolveTeamSeasonSwitcherAction(ts.status) === 'select-work') {
      setSelectedTeamSeasonId(ts.id);
      if (ts.id !== selectedTeamSeasonId && pathname.startsWith('/app/live')) navigate('/app/live', { replace: true });
    }
    else setViewTeamSeasonId(ts.id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const toggle = (id: string) => {
    const selected = filtered ? filteredTeamSeasonIds : value && currentSeasons.some((ts) => ts.id === value) ? [value] : [];
    const next = selected.includes(id) ? selected.filter((sid) => sid !== id) : [...selected, id];
    if (next.length === 0) return;
    if (next.length === 1) {
      setSelectedTeamSeasonId(next[0]);
      if (next[0] !== selectedTeamSeasonId && pathname.startsWith('/app/live')) navigate('/app/live', { replace: true });
      setTeamViewFilter(null);
    } else {
      setTeamViewFilter(next);
    }
  };

  const searchedCurrentSeasons = currentSeasons.filter(ts => !teamSearch.trim() || compactLabel(ts).toLocaleLowerCase('de').includes(teamSearch.trim().toLocaleLowerCase('de')));
  const toggleOpen = () => {
    setOpen((value) => !value);
  };

  if (teamSeasons.length === 0) return hideWhenSingle ? null : <span className="text-xs text-white/60">Keine Mannschaften</span>;
  if (hideWhenSingle && teamSeasons.length < 2) return null;

  const renderSeason = (ts: SessionTeamSeasonItem, checkboxes: boolean) => {
    const checked = filtered ? filteredTeamSeasonIds.includes(ts.id) : ts.id === value;
    const rowClass = `mb-1 flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left text-[14px] font-bold leading-snug transition-colors ${checked ? 'bg-[rgb(var(--club-primary-rgb)/0.2)] border-[rgb(var(--club-border-rgb)/0.5)] text-white' : 'border-white/10 text-white/85 hover:bg-white/[0.06]'}`;
    const text = <span className="min-w-0 flex-1">
      <span className="block [overflow-wrap:anywhere]">{formatTeamSeasonContextLabel({ displayName: ts.display_name, ageGroup: ts.age_group, teamName: ts.team?.name, seasonName: ts.season?.name }, { includeSeason: false })}</span>
      <span className="mt-1 block text-[12px] font-medium text-white/55">{seasonLabel(ts)}</span>
    </span>;
    return checkboxes ? (
      <label key={ts.id} className={rowClass}>
        <img src={getClubLogo(ts.team?.name || '', { teamId: ts.team?.id })} alt="" className="h-9 w-9 shrink-0 object-contain" />
        {text}
        <input type="checkbox" checked={checked} onChange={() => toggle(ts.id)}
          aria-label={compactLabel(ts)}
          className="h-6 w-6 shrink-0 cursor-pointer rounded-md accent-red-500" />
      </label>
    ) : (
      <button key={ts.id} type="button" onClick={() => selectSingle(ts)} className={rowClass} aria-pressed={checked}>
        <img src={getClubLogo(ts.team?.name || '', { teamId: ts.team?.id })} alt="" className="h-9 w-9 shrink-0 object-contain" />
        {text}{checked ? <Check className="sz-club-accent-text h-5 w-5 shrink-0" aria-hidden /> : null}
      </button>
    );
  };

  return <>
    <button ref={triggerRef} type="button" onClick={toggleOpen}
      aria-label="Favoriten und Mannschaften wählen" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog"
      className={['focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--club-accent-rgb))] flex min-h-[48px] w-full min-w-0 items-center justify-between gap-3 bg-transparent px-2 py-1.5 text-left text-white/95', compact ? 'md:min-w-[210px]' : '', className].filter(Boolean).join(' ')}>
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold sm:text-sm">{triggerLabel}</span><span className="mt-0.5 block text-[11px] font-medium text-white/50">{triggerSubtitle}</span></span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-white/55 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
    </button>
    {open && typeof document !== 'undefined' ? createPortal(
      <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/65 backdrop-blur-sm" role="presentation">
      <div ref={panelRef} id={panelId} role="dialog" aria-modal="true" aria-label="Favoriten und Mannschaften"
        className="sz-club-surface flex max-h-[min(82dvh,44rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-[rgb(var(--club-border-rgb)/0.5)] !bg-[linear-gradient(155deg,#1c1016,#0d0b0d_60%)] p-3 shadow-[0_-16px_60px_rgba(0,0,0,0.65)]">
        <div className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-white/30" aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-3 pt-1">
          <h2 className="text-lg font-bold text-white">Meine Favoriten</h2>
          <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="sz-club-accent-text min-h-[44px] px-2 text-sm font-bold">Fertig</button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-red-400" aria-hidden />
          <input type="search" value={teamSearch} onChange={event => setTeamSearch(event.target.value)} placeholder="Mannschaft suchen, z. B. Melk" aria-label="Mannschaft suchen"
            className="min-h-[50px] w-full rounded-xl border border-red-500/35 bg-[#1c1116] py-3 pl-11 pr-3 text-[15px] text-white placeholder:text-white/45 focus:border-red-400 focus:outline-none" />
        </label>
        {multipleAvailable && !teamSearch.trim() ? <>
          <button type="button" onClick={() => { setTeamViewFilter('all'); setOpen(false); triggerRef.current?.focus(); }}
            aria-pressed={teamViewFilter === 'all'}
            className={`mb-2 flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] font-bold transition-colors ${teamViewFilter === 'all' ? 'border-red-500/65 bg-red-900/35 text-white' : 'border-red-500/25 bg-white/[0.035] text-white/90 hover:bg-red-950/25'}`}>
            <span>Alle Mannschaften <span className="ml-1 text-xs font-medium text-white/50">({currentSeasons.length})</span></span>{teamViewFilter === 'all' ? <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500"><Check className="h-4 w-4 text-white" aria-hidden /></span> : <span className="h-6 w-6 rounded-lg border border-white/35" aria-hidden />}
          </button>
          <p className="px-3 py-2 text-[11px] text-white/45">Alle aktuellen Mannschaften gemeinsam oder einzeln anzeigen.</p>
        </> : null}
        {[
          { label: 'Meine Mannschaften & Favoriten', rows: searchedCurrentSeasons },
        ].map(({ label, rows }) => rows.length ? <section key={label}>
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</p>
          {rows.map((ts) => renderSeason(ts, multipleAvailable))}
        </section> : null)}
        {searchedCurrentSeasons.length === 0 && teamSearch.trim() ? <p className="px-3 py-2 text-sm text-white/60">Keine passende SpielzeitApp-Mannschaft gefunden. Für weitere ÖFB-Vereine kannst du unten einen Link speichern.</p> : null}
        {otherSeasons.length && !teamSearch.trim() ? <section className="mt-2 border-t border-white/10 pt-2">
          <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Archiv & Vorbereitung · einzeln anzeigen</p>
          {otherSeasons.map((ts) => renderSeason(ts, false))}
        </section> : null}
        <section className="mt-3 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between px-3 pb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Weitere Vereinsfavoriten</p>
            <Star className="h-4 w-4 text-amber-400" aria-hidden />
          </div>
          <p className="px-3 pb-2 text-[12px] leading-snug text-white/55">ÖFB-Mannschaften, etwa aus Melk, als Favoriten speichern. Öffnet das öffentliche ÖFB-Profil.</p>
          {externalFavorites.map(item => <div key={item.url} className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <Star className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-[14px] font-semibold text-white">
              <span className="min-w-0 flex-1 break-words">{item.name}</span><ExternalLink className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
            </a>
            <button type="button" onClick={() => saveFavorites(externalFavorites.filter(f => f.url !== item.url))} aria-label={`${item.name} aus Favoriten entfernen`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-red-950/40"><Trash2 className="h-4 w-4" /></button>
          </div>)}
          {addingFavorite ? <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-950/15 p-3">
            <label className="block text-xs font-semibold text-white/75">Mannschaft / Verein
              <input value={favoriteName} onChange={e => setFavoriteName(e.target.value)} placeholder="z. B. ASK Loosdorf · Kampfmannschaft" maxLength={100} className="mt-1 min-h-[44px] w-full rounded-lg border border-white/20 bg-black/40 px-3 text-sm text-white" />
            </label>
            <label className="block text-xs font-semibold text-white/75">ÖFB-Spielplan- oder Mannschaftslink
              <input type="url" value={favoriteUrl} onChange={e => setFavoriteUrl(e.target.value)} placeholder="https://vereine.oefb.at/..." className="mt-1 min-h-[44px] w-full rounded-lg border border-white/20 bg-black/40 px-3 text-sm text-white" />
            </label>
            {favoriteError ? <p role="alert" className="text-xs text-red-300">{favoriteError}</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={addExternalFavorite} className="min-h-[44px] flex-1 rounded-lg bg-red-700 px-3 text-sm font-bold text-white">Favorit speichern</button>
              <button type="button" onClick={() => { setAddingFavorite(false); setFavoriteError(''); }} className="min-h-[44px] rounded-lg border border-white/20 px-3 text-sm text-white">Abbrechen</button>
            </div>
          </div> : <button type="button" onClick={() => setAddingFavorite(true)} className="flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-dashed border-red-500/40 px-3 text-left text-sm font-semibold text-red-200">
            <Plus className="h-4 w-4" /> Verein über ÖFB-Link hinzufügen
          </button>}
        </section>

        </div>
      </div>
      </div>, document.body,
    ) : null}
  </>;
};
