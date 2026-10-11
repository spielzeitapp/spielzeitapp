import React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import type { SessionTeamSeasonItem } from '../../auth/useSession';
import {
  formatTeamSeasonContextLabel,
  isSeasonActive,
  resolveTeamSeasonSwitcherAction,
} from '../../lib/seasonLifecycle';

function seasonLabel(ts: SessionTeamSeasonItem, activeId: string | null): string {
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
  const overview = pathname === '/app' || pathname === '/app/home' || pathname === '/app/termine';
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0, maxHeight: 0 });
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
    : compactLabel(current ?? teamSeasons[0]);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const closeOnResize = () => setOpen(false);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keydown);
    window.addEventListener('resize', closeOnResize);
    panelRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [open]);

  const selectSingle = (ts: SessionTeamSeasonItem) => {
    setTeamViewFilter(null);
    if (resolveTeamSeasonSwitcherAction(ts.status) === 'select-work') setSelectedTeamSeasonId(ts.id);
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
      setTeamViewFilter(null);
    } else {
      setTeamViewFilter(next);
    }
  };

  const toggleOpen = () => {
    if (open) { setOpen(false); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(360, window.innerWidth - 24);
    const top = Math.min(rect.bottom + 8, Math.max(12, window.innerHeight - 280));
    setPosition({
      top, width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      maxHeight: Math.max(120, window.innerHeight - top - 24),
    });
    setOpen(true);
  };

  if (teamSeasons.length === 0) return hideWhenSingle ? null : <span className="text-xs text-white/60">Keine Mannschaften</span>;
  if (hideWhenSingle && teamSeasons.length < 2) return null;
  // The header needs no extra selector on Home/Termine for a single current season.
  if (overview && compact && teamSeasons.length <= 1 && !filtered) return null;

  const renderSeason = (ts: SessionTeamSeasonItem, checkboxes: boolean) => {
    const checked = filtered ? filteredTeamSeasonIds.includes(ts.id) : ts.id === value;
    const rowClass = `flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold leading-snug transition-colors ${checked ? 'sz-club-selected-soft text-white' : 'text-white/85 hover:bg-white/[0.06]'}`;
    const text = <span className="min-w-0 flex-1">
      <span className="block [overflow-wrap:anywhere]">{formatTeamSeasonContextLabel({ displayName: ts.display_name, ageGroup: ts.age_group, teamName: ts.team?.name, seasonName: ts.season?.name }, { includeSeason: false })}</span>
      <span className="mt-0.5 block text-[11px] font-medium text-white/55">{seasonLabel(ts, selectedTeamSeasonId)}</span>
    </span>;
    return checkboxes ? (
      <label key={ts.id} className={rowClass}>
        {text}
        <input type="checkbox" checked={checked} onChange={() => toggle(ts.id)}
          aria-label={compactLabel(ts)}
          className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--club-primary,#ef4444)]" />
      </label>
    ) : (
      <button key={ts.id} type="button" onClick={() => selectSingle(ts)} className={rowClass} aria-pressed={checked}>
        {text}{checked ? <Check className="sz-club-icon h-5 w-5 shrink-0" aria-hidden /> : null}
      </button>
    );
  };

  return <>
    <button ref={triggerRef} type="button" onClick={toggleOpen}
      aria-label="Mannschaft & Saison wählen" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog"
      className={['sz-club-focus inline-flex min-h-[36px] max-w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-left text-xs font-bold text-white/95 shadow-sm', className].filter(Boolean).join(' ')}>
      <span className="min-w-0 truncate">{triggerLabel}</span>
      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/55 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
    </button>
    {open && typeof document !== 'undefined' ? createPortal(
      <div ref={panelRef} id={panelId} role="dialog" aria-label="Mannschaft & Saison" style={{ ...position, position: 'fixed', zIndex: 220 }}
        className="sz-club-surface overflow-y-auto overscroll-contain rounded-[20px] border border-[var(--club-primary-border,rgba(239,68,68,0.3))] !bg-[#0d0b0d] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">Mannschaft & Saison</h2>
          <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="min-h-[36px] px-2 text-xs font-bold text-white/75">Fertig</button>
        </div>
        {multipleAvailable ? <>
          <button type="button" onClick={() => { setTeamViewFilter('all'); setOpen(false); triggerRef.current?.focus(); }}
            aria-pressed={teamViewFilter === 'all'}
            className={`mb-1 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${teamViewFilter === 'all' ? 'sz-club-selected-soft' : 'hover:bg-white/[0.06]'}`}>
            Alle Mannschaften{teamViewFilter === 'all' ? <Check className="sz-club-icon h-5 w-5" aria-hidden /> : null}
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
      </div>, document.body,
    ) : null}
  </>;
};
