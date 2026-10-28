import React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Star, ExternalLink, Search, ArrowLeft, Users, MoreHorizontal, Trash2 } from 'lucide-react';
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
  iconOnly?: boolean;
};

/** Single work season stays separate from the read-only multi-team overview. */
export const TeamSwitcher: React.FC<TeamSwitcherProps> = ({ compact = false, className, hideWhenSingle = false, iconOnly = false }) => {
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
  const [favoriteMenuUrl, setFavoriteMenuUrl] = React.useState<string | null>(null);
  const [hiddenTeamIds, setHiddenTeamIds] = React.useState<string[]>([]);
  const hiddenStorageKey = user?.id ? `spz_hidden_team_favorites_${user.id}` : null;
  React.useEffect(() => {
    setHiddenTeamIds([]);
    if (!hiddenStorageKey) return;
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(hiddenStorageKey) || '[]');
      if (Array.isArray(parsed)) setHiddenTeamIds(parsed.filter((id): id is string => typeof id === 'string'));
    } catch { /* Ignore invalid preference. */ }
  }, [hiddenStorageKey]);
  const persistHiddenTeamIds = (ids: string[]) => {
    if (hiddenStorageKey) {
      try { window.localStorage.setItem(hiddenStorageKey, JSON.stringify(ids)); }
      catch { window.alert('Favoriten konnten nicht gespeichert werden.'); return false; }
    }
    setHiddenTeamIds(ids);
    return true;
  };
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
  const removeExternalFavorite = (url: string) => {
    const next = externalFavorites.filter(item => item.url !== url);
    if (favoriteStorageKey) {
      try {
        window.localStorage.setItem(favoriteStorageKey, JSON.stringify(next));
      } catch {
        window.alert('Favorit konnte nicht gespeichert werden. Bitte Speicherzugriff prüfen.');
        return;
      }
    }
    setExternalFavorites(next);
    setFavoriteMenuUrl(null);
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

  const searchedCurrentSeasons = currentSeasons.filter(ts =>
    (teamSearch.trim() || !hiddenTeamIds.includes(ts.id)) &&
    (!teamSearch.trim() || compactLabel(ts).toLocaleLowerCase('de').includes(teamSearch.trim().toLocaleLowerCase('de')))
  );
  const removeTeamFavorite = (id: string) => {
    const visible = currentSeasons.filter(ts => !hiddenTeamIds.includes(ts.id));
    if (visible.length <= 1) {
      window.alert('Mindestens eine Mannschaft muss in deinen Favoriten bleiben.');
      return;
    }
    const nextVisible = visible.filter(ts => ts.id !== id);
    if (!persistHiddenTeamIds([...hiddenTeamIds, id])) return;
    if (filtered) {
      const selected = teamViewFilter === 'all' ? currentSeasons.map(ts => ts.id) : filteredTeamSeasonIds;
      const next = selected.filter(sid => sid !== id && nextVisible.some(ts => ts.id === sid));
      if (next.length > 1) setTeamViewFilter(next);
      else if (next.length === 1) { setSelectedTeamSeasonId(next[0]); setTeamViewFilter(null); }
      else { setSelectedTeamSeasonId(nextVisible[0].id); setTeamViewFilter(null); }
    } else if (value === id) {
      setSelectedTeamSeasonId(nextVisible[0].id);
      setTeamViewFilter(null);
    }
    setFavoriteMenuUrl(null);
  };
  const addTeamFavorite = (id: string) => {
    if (!hiddenTeamIds.includes(id)) return;
    persistHiddenTeamIds(hiddenTeamIds.filter(existing => existing !== id));
  };
  const toggleOpen = () => {
    setTeamSearch('');
    setFavoriteMenuUrl(null);
    setOpen((value) => !value);
  };

  if (teamSeasons.length === 0) return hideWhenSingle ? null : <span className="text-xs text-white/60">Keine Mannschaften</span>;
  if (hideWhenSingle && teamSeasons.length < 2) return null;

  const renderSeason = (ts: SessionTeamSeasonItem, checkboxes: boolean) => {
    const checked = filtered ? filteredTeamSeasonIds.includes(ts.id) : ts.id === value;
    const rowClass = `relative mb-3 flex min-h-[104px] w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.16)] text-left text-[16px] font-bold leading-snug transition-colors ${checked ? 'border-[rgb(var(--club-border-rgb)/0.7)] bg-[rgb(var(--club-primary-rgb)/0.22)] text-white' : 'border-white/10 bg-white/[0.035] text-white/90 hover:bg-white/[0.08]'}`;
    const text = <span className="min-w-0 flex-1">
      <span className="block [overflow-wrap:anywhere]">{ts.team?.name || ts.display_name || 'Mannschaft'}{ts.age_group ? ` · ${ts.age_group}` : ''}</span>
      <span className="mt-1 block text-[14px] font-medium text-white/75">{ts.season?.name ?? ''}</span>
      <span className="mt-1 block text-[12px] font-medium text-white/55">{isSeasonActive(ts.status) ? 'Aktuelle Mannschaft' : ts.status === 'draft' ? 'In Vorbereitung' : 'Archiv'}</span>
    </span>;
    const hidden = hiddenTeamIds.includes(ts.id);
    return hidden ? (
      <button key={ts.id} type="button" onClick={() => addTeamFavorite(ts.id)} className={rowClass} aria-label={`${compactLabel(ts)} wieder zu Favoriten hinzufügen`}>
        <img src={getClubLogo(ts.team?.name || '', { teamId: ts.team?.id })} alt="" className="h-11 w-11 shrink-0 object-contain" />
        {text}<span className="shrink-0 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-bold text-red-300">Hinzufügen</span>
      </button>
    ) : checkboxes ? (
      <div key={ts.id} className={rowClass}>
        <img src={getClubLogo(ts.team?.name || '', { teamId: ts.team?.id })} alt="" className="h-11 w-11 shrink-0 object-contain" />
        {text}
        <input type="checkbox" checked={checked} onChange={() => toggle(ts.id)}
          aria-label={compactLabel(ts)}
          className="h-7 w-7 shrink-0 cursor-pointer rounded-full accent-red-600" />
        <div className="relative shrink-0">
          <button type="button" aria-label={`${compactLabel(ts)}: Optionen`} aria-expanded={favoriteMenuUrl === ts.id} onClick={() => setFavoriteMenuUrl(current => current === ts.id ? null : ts.id)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 text-white/80"><MoreHorizontal className="h-5 w-5" aria-hidden /></button>
          {favoriteMenuUrl === ts.id ? (
            <div className="absolute right-0 top-full z-30 mt-2 w-[220px] rounded-xl border border-red-500/40 bg-[#211016] p-1 shadow-2xl">
              <button type="button" onClick={() => removeTeamFavorite(ts.id)} className="flex min-h-[48px] w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-red-200 active:bg-red-900/40"><Trash2 className="h-4 w-4 shrink-0" aria-hidden /> Aus Favoriten entfernen</button>
            </div>
          ) : null}
        </div>
      </div>
    ) : (
      <div key={ts.id} className={rowClass}>
        <img src={getClubLogo(ts.team?.name || '', { teamId: ts.team?.id })} alt="" className="h-11 w-11 shrink-0 object-contain" />
        <button type="button" onClick={() => selectSingle(ts)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-pressed={checked}>
          {text}
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${checked ? 'border-red-500 bg-red-700' : 'border-white/20'}`}>{checked ? <Check className="h-5 w-5 text-white" aria-hidden /> : null}</span>
        </button>
        {isSeasonActive(ts.status) ? (
          <div className="relative shrink-0">
            <button type="button" aria-label={`${compactLabel(ts)}: Optionen`} aria-expanded={favoriteMenuUrl === ts.id} onClick={() => setFavoriteMenuUrl(current => current === ts.id ? null : ts.id)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 text-white/80"><MoreHorizontal className="h-5 w-5" aria-hidden /></button>
            {favoriteMenuUrl === ts.id ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-[220px] rounded-xl border border-red-500/40 bg-[#211016] p-1 shadow-2xl">
                <button type="button" onClick={() => removeTeamFavorite(ts.id)} className="flex min-h-[48px] w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-red-200 active:bg-red-900/40"><Trash2 className="h-4 w-4 shrink-0" aria-hidden /> Aus Favoriten entfernen</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return <>
    <button ref={triggerRef} type="button" onClick={toggleOpen}
      aria-label="Favoriten und Mannschaften wählen" title="Meine Favoriten" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog"
      className={iconOnly
        ? ['inline-flex !h-11 !w-11 !min-h-11 !min-w-11 !max-w-11 !flex-none !shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] !p-0 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500', className].filter(Boolean).join(' ')
        : ['flex min-h-[48px] w-full min-w-0 items-center justify-between gap-3 bg-transparent px-2 py-1.5 text-left text-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--club-accent-rgb))]', compact ? 'md:min-w-[210px]' : '', className].filter(Boolean).join(' ')}>
      <span className={iconOnly ? 'flex items-center justify-center' : 'flex min-w-0 flex-1 items-center gap-2.5'}>
        <span className={iconOnly ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full' : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--club-border-rgb)/0.35)] bg-[rgb(var(--club-primary-rgb)/0.2)]'}>
          <Star className="h-[18px] w-[18px] text-[rgb(var(--club-accent-rgb))]" aria-hidden />
        </span>
        {!iconOnly ? <span className="truncate text-[14px] font-bold sm:text-[15px]">Meine Favoriten</span> : null}
      </span>
      {!iconOnly ? <ChevronDown className={`h-5 w-5 shrink-0 text-[rgb(var(--club-accent-rgb))] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden /> : null}
    </button>
    {open && typeof document !== 'undefined' ? createPortal(
      <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/65 backdrop-blur-sm" role="presentation">
      <div ref={panelRef} id={panelId} role="dialog" aria-modal="true" aria-label="Favoriten und Mannschaften"
        className="sz-club-surface flex max-h-[min(92dvh,52rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-[rgb(var(--club-border-rgb)/0.5)] !bg-[linear-gradient(155deg,#2a0d16,#160d12_35%,#09090b_75%)] p-3 shadow-[0_-16px_60px_rgba(0,0,0,0.65)]">
        <div className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-white/30" aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-2 pt-1">
          <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="flex min-h-[44px] items-center gap-2 rounded-xl border border-red-500/45 px-3 text-sm font-bold text-white/85"><ArrowLeft className="h-4 w-4 text-red-400" aria-hidden /> Zurück</button>
          <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="sz-club-accent-text min-h-[44px] px-2 text-sm font-bold">Fertig</button>
        </div>
        <div className="shrink-0 px-2 pb-3 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/55 bg-red-950/40"><Star className="h-6 w-6 text-red-400" aria-hidden /></div>
          <h2 className="text-[22px] font-black leading-tight text-white">Favoriten verwalten</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-white/65">Wähle deine Mannschaften einzeln oder gemeinsam. Deine Auswahl bleibt gespeichert.</p>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-red-400" aria-hidden />
          <input type="search" value={teamSearch} onChange={event => setTeamSearch(event.target.value)} placeholder="Verein oder Mannschaft suchen" aria-label="Verein oder Mannschaft suchen"
            className="min-h-[50px] w-full rounded-xl border border-red-500/35 bg-[#1c1116] py-3 pl-11 pr-3 text-[15px] text-white placeholder:text-white/45 focus:border-red-400 focus:outline-none" />
        </label>
        {multipleAvailable && !teamSearch.trim() ? <>
          <button type="button" onClick={() => { setTeamViewFilter(currentSeasons.filter(ts => !hiddenTeamIds.includes(ts.id)).map(ts => ts.id)); setOpen(false); triggerRef.current?.focus(); }}
            aria-pressed={teamViewFilter === 'all' || (Array.isArray(teamViewFilter) && teamViewFilter.length === currentSeasons.length - hiddenTeamIds.length)}
            className={`mb-2 flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] font-bold transition-colors ${(teamViewFilter === 'all' || (Array.isArray(teamViewFilter) && teamViewFilter.length === currentSeasons.length - hiddenTeamIds.length)) ? 'border-red-500/65 bg-red-900/35 text-white' : 'border-red-500/25 bg-white/[0.035] text-white/90 hover:bg-red-950/25'}`}>
            <span className="flex items-center gap-3"><Users className="h-5 w-5 text-red-300" aria-hidden /><span>Alle Mannschaften <span className="ml-1 text-xs font-medium text-white/50">({currentSeasons.length - hiddenTeamIds.length})</span></span></span>{(teamViewFilter === 'all' || (Array.isArray(teamViewFilter) && teamViewFilter.length === currentSeasons.length - hiddenTeamIds.length)) ? <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500"><Check className="h-4 w-4 text-white" aria-hidden /></span> : <span className="h-6 w-6 rounded-lg border border-white/35" aria-hidden />}
          </button>

        </> : null}
        {[
          { label: 'Meine Mannschaften & Favoriten', rows: searchedCurrentSeasons },
        ].map(({ label, rows }) => rows.length ? <section key={label}>
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</p>
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
          {externalFavorites.map(item => <div key={item.url} className="mb-2 rounded-xl border border-white/10 bg-white/[0.04]">
            <div className="flex min-h-[52px] items-center gap-2 px-3 py-2">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-white">
                <Star className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                <span className="min-w-0 flex-1 break-words">{item.name}</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
              </a>
              <button type="button" aria-label={`${item.name}: Optionen`} aria-expanded={favoriteMenuUrl === item.url} onClick={() => setFavoriteMenuUrl(current => current === item.url ? null : item.url)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/80">
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {favoriteMenuUrl === item.url ? <div className="border-t border-white/10 px-3 py-2">
              <button type="button" onClick={() => removeExternalFavorite(item.url)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-red-300 hover:bg-red-950/30">
                <Trash2 className="h-4 w-4" aria-hidden /> Aus Favoriten entfernen
              </button>
            </div> : null}
          </div>)}
        </section> : null}


        </div>
      </div>
      </div>, document.body,
    ) : null}
  </>;
};
