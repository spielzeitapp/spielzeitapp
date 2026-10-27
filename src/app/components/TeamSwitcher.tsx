import React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Star, ExternalLink, Search } from 'lucide-react';
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
    const rowClass = `mb-3 flex min-h-[104px] w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-4 text-left text-[16px] font-bold leading-snug transition-colors ${checked ? 'border-[rgb(var(--club-border-rgb)/0.7)] bg-[rgb(var(--club-primary-rgb)/0.22)] text-white' : 'border-white/10 bg-white/[0.035] text-white/90 hover:bg-white/[0.08]'}`;
    const text = <span className="min-w-0 flex-1">
      <span className="block [overflow-wrap:anywhere]">{ts.team?.name || ts.display_name || 'Mannschaft'}{ts.age_group ? ` · ${ts.age_group}` : ''}</span>
      <span className="mt-1 block text-[14px] font-medium text-white/75">{ts.season?.name ?? ''}</span>
      <span className="mt-1 block text-[12px] font-medium text-white/55">{isSeasonActive(ts.status) ? 'Aktuelle Mannschaft' : ts.status === 'draft' ? 'In Vorbereitung' : 'Archiv'}</span>
    </span>;
    return checkboxes ? (
      <label key={ts.id} className={rowClass}>
        <img src={getClubLogo(ts.team?.name || '', { teamId: ts.team?.id })} alt="" className="h-11 w-11 shrink-0 object-contain" />
        {text}
        <input type="checkbox" checked={checked} onChange={() => toggle(ts.id)}
          aria-label={compactLabel(ts)}
          className="h-7 w-7 shrink-0 cursor-pointer rounded-full accent-red-600" />
      </label>
    ) : (
      <button key={ts.id} type="button" onClick={() => selectSingle(ts)} className={rowClass} aria-pressed={checked}>
        <img src={getClubLogo(ts.team?.name || '', { teamId: ts.team?.id })} alt="" className="h-11 w-11 shrink-0 object-contain" />
        {text}<span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${checked ? 'border-red-500 bg-red-700' : 'border-white/20'}`}>{checked ? <Check className="h-5 w-5 text-white" aria-hidden /> : null}</span>
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
        className="sz-club-surface flex max-h-[min(88dvh,48rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-[rgb(var(--club-border-rgb)/0.5)] !bg-[linear-gradient(155deg,#1c1016,#0d0b0d_60%)] p-3 shadow-[0_-16px_60px_rgba(0,0,0,0.65)]">
        <div className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-white/30" aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-3 pt-1">
          <h2 className="text-xl font-extrabold text-white">Favoriten verwalten</h2>
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
          <p className="px-3 py-2 text-[12px] text-white/60">Wähle deine Mannschaften aus. Die Auswahl bleibt gespeichert.</p>
        </> : null}
        {[
          { label: 'Meine Mannschaften & Favoriten', rows: searchedCurrentSeasons },
        ].map(({ label, rows }) => rows.length ? <section key={label}>
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</p>
          {rows.map((ts) => renderSeason(ts, multipleAvailable))}
        </section> : null)}
        {searchedCurrentSeasons.length === 0 && teamSearch.trim() ? <p className="px-3 py-2 text-sm text-white/60">Keine passende Mannschaft vorhanden. Neue Vereine und Mannschaften werden durch die Vereinsverwaltung im Spielzeit Manager eingerichtet.</p> : null}
        {otherSeasons.length && !teamSearch.trim() ? <section className="mt-2 border-t border-white/10 pt-2">
          <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Archiv & Vorbereitung · einzeln anzeigen</p>
          {otherSeasons.map((ts) => renderSeason(ts, false))}
        </section> : null}
        {externalFavorites.length > 0 ? <section className="mt-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2 px-3 pb-2">
            <Star className="h-4 w-4 text-amber-400" aria-hidden />
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Weitere Favoriten</p>
          </div>
          {externalFavorites.map(item => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"
            className="mb-2 flex min-h-[52px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white">
            <Star className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <span className="min-w-0 flex-1 break-words">{item.name}</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
          </a>)}
        </section> : null}


        </div>
      </div>
      </div>, document.body,
    ) : null}
  </>;
};
