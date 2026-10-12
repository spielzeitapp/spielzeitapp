import React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus } from 'lucide-react';
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
    teamSeasons, selectedTeamSeasonId, setSelectedTeamSeasonId,
    viewTeamSeasonId, setViewTeamSeasonId, memberships,
    teamViewFilter, setTeamViewFilter, filteredTeamSeasonIds,
  } = useSession();
  const overview = pathname === '/app' || pathname === '/app/home' || pathname === '/app/termine' || pathname === '/app/tabelle';
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();
  const value = viewTeamSeasonId ?? selectedTeamSeasonId;
  const current = teamSeasons.find((ts) => ts.id === value);
  const currentSeasons = teamSeasons.filter((ts) => isSeasonActive(ts.status));
  const otherSeasons = teamSeasons.filter((ts) => !isSeasonActive(ts.status));
  const multipleAvailable = overview && currentSeasons.length > 1;
  const filtered = overview && teamViewFilter !== null;
  const ownIds = new Set(memberships.filter((m) => String(m.role).trim().toLowerCase() !== 'fan').map((m) => m.team_season_id));
  const triggerLabel = filtered
    ? teamViewFilter === 'all' ? 'Alle Mannschaften' : `${filteredTeamSeasonIds.length} Mannschaften`
    : formatTeamSeasonContextLabel({ displayName: (current ?? teamSeasons[0])?.display_name, ageGroup: (current ?? teamSeasons[0])?.age_group, teamName: (current ?? teamSeasons[0])?.team?.name, seasonName: (current ?? teamSeasons[0])?.season?.name }, { includeSeason: false });
  const triggerSubtitle = filtered ? 'Aktuelle Mannschaften' : [current?.season?.name, current?.status === 'archived' ? 'Archiv' : current?.status === 'draft' ? 'In Vorbereitung' : null].filter(Boolean).join(' · ');

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
          className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--club-primary,#ef4444)]" />
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
      aria-label="Mannschaft & Saison wählen" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog"
      className={['focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--club-accent-rgb))] flex min-h-[48px] w-full min-w-0 items-center justify-between gap-3 bg-transparent px-2 py-1.5 text-left text-white/95', compact ? 'md:min-w-[210px]' : '', className].filter(Boolean).join(' ')}>
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold sm:text-sm">{triggerLabel}</span><span className="mt-0.5 block text-[11px] font-medium text-white/50">{triggerSubtitle}</span></span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-white/55 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
    </button>
    {open && typeof document !== 'undefined' ? createPortal(
      <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/65 backdrop-blur-sm" role="presentation">
      <div ref={panelRef} id={panelId} role="dialog" aria-modal="true" aria-label="Mannschaft & Saison"
        className="sz-club-surface flex max-h-[min(82dvh,44rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-[rgb(var(--club-border-rgb)/0.5)] !bg-[#0d0b0d] p-3 shadow-[0_-16px_60px_rgba(0,0,0,0.65)]">
        <div className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-white/30" aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-3 pt-1">
          <h2 className="text-lg font-bold text-white">Mannschaft & Saison</h2>
          <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="sz-club-accent-text min-h-[44px] px-2 text-sm font-bold">Fertig</button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        {multipleAvailable ? <>
          <button type="button" onClick={() => { setTeamViewFilter('all'); setOpen(false); triggerRef.current?.focus(); }}
            aria-pressed={teamViewFilter === 'all'}
            className={`mb-1 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${teamViewFilter === 'all' ? 'bg-[rgb(var(--club-primary-rgb)/0.2)]' : 'hover:bg-white/[0.06]'}`}>
            Alle Mannschaften{teamViewFilter === 'all' ? <Check className="sz-club-accent-text h-5 w-5" aria-hidden /> : null}
          </button>
          <p className="px-3 py-2 text-[11px] text-white/45">Eine oder mehrere aktuelle Mannschaften auswählen.</p>
        </> : null}
        {[
          { label: 'Meine Mannschaften', rows: currentSeasons.filter((ts) => ownIds.has(ts.id)) },
          { label: 'Favoriten', rows: currentSeasons.filter((ts) => !ownIds.has(ts.id)) },
        ].map(({ label, rows }) => rows.length ? <section key={label}>
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</p>
          {rows.map((ts) => renderSeason(ts, multipleAvailable))}
        </section> : null)}
        {otherSeasons.length ? <section className="mt-2 border-t border-white/10 pt-2">
          <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Archiv & Vorbereitung · einzeln anzeigen</p>
          {otherSeasons.map((ts) => renderSeason(ts, false))}
        </section> : null}
        <button type="button" onClick={() => { setOpen(false); navigate('/app/fan-onboarding'); }}
          className="mt-2 flex min-h-[48px] w-full items-center gap-2 border-t border-white/10 px-3 py-3 text-left text-sm font-bold text-white/85">
          <Plus className="h-4 w-4 shrink-0" aria-hidden />Favoriten verwalten
        </button>
        </div>
      </div>
      </div>, document.body,
    ) : null}
  </>;
};
