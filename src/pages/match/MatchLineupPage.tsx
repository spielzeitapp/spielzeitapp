import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayers } from '../../hooks/usePlayers';
import type { PlayerItem } from '../../hooks/usePlayers';
import { LeibchenJersey } from '../../components/match/LeibchenJersey';
import { LineupFormationPitch } from '../../components/match/LineupFormationPitch';
import { PitchPlayerMarker } from '../../components/match/PitchPlayerMarker';
import { triggerLineupFeedPostAfterSave } from '../../lib/ensureLineupFeedPost';
import {
  fetchLineupForLiveMatch,
  LIVE_FIELD_SLOT_ORDER,
  replaceMatchLineupAndBench,
  sanitizeLineupToMatchSquad,
  updateMatchRow,
} from '../../lib/liveMatchService';
import {
  isU11FormationId,
  labelForSlotInFormation,
  readStoredU11Formation,
  U11_FORMATION_CHOICES,
  U11_FORMATION_DB_FALLBACK,
  writeStoredU11Formation,
  type U11FormationId,
} from '../../lib/matchFormations';
import { supabase } from '../../lib/supabaseClient';
import type { FieldSlotId } from '../../types/match';
import { getPositionLabel } from '../../lib/positionLabels';
import {
  matchdayBenchTileClass,
  matchdayJerseyWrapClass,
  matchdayLineupListRowClass,
  matchdayLineupPositionBadgeClass,
} from '../../lib/matchdayPlayerCard';
import { premiumPlayerDisplayName } from '../../lib/premiumPlayerCard';
import {
  dsFormationTabClass,
  dsFormationZoneGlowClass,
  dsPageAtmosphereClass,
  dsPageContentClass,
  dsPageShellClass,
  dsPageTitleClass,
  dsPlayerNameClass,
  dsSectionLabelClass,
  dsPrimaryCtaClass,
  dsSecondaryCtaClass,
  dsSegmentTabClass,
  dsStickyCtaBarClass,
  DS_JERSEY_STARTER,
  DS_LIST_GAP,
} from '../../lib/premiumDesignSystem';

type MatchRowLite = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  u11_formation_id: string | null;
};

type LocationState = {
  selectedPlayers?: string[];
} | null;

function emptySlots(): Record<FieldSlotId, string | null> {
  return {
    GK: null,
    LB: null,
    RB: null,
    CM: null,
    LW: null,
    RW: null,
    ST: null,
    FP: null,
  };
}

const normalizeId = (id: string | null | undefined): string | null => {
  const v = String(id ?? '').trim();
  return v.length > 0 ? v : null;
};

function playerFamilyName(p: PlayerItem): string {
  const ln = (p.last_name ?? '').trim();
  if (ln) return ln;
  const parts = p.display_name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : p.display_name;
}

function benchPositionLabel(p: PlayerItem): string {
  const mapped = getPositionLabel(p.position) || '';
  if (!mapped) return '–';
  return mapped.toUpperCase();
}

function mobileLineupName(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : name || '—';
}

export const MatchLineupPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('matchId')?.trim() || null;
  const routeState = (location.state ?? null) as LocationState;
  const selectedFromState = useMemo(
    () => [...new Set((routeState?.selectedPlayers ?? []).map((id) => normalizeId(id)).filter((id): id is string => Boolean(id)))],
    [routeState?.selectedPlayers],
  );

  const [matchRow, setMatchRow] = useState<MatchRowLite | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [lineupLoading, setLineupLoading] = useState(true);
  const [lineupError, setLineupError] = useState<string | null>(null);
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [slots, setSlots] = useState<Record<FieldSlotId, string | null>>(emptySlots);
  const [selectedBankPlayerId, setSelectedBankPlayerId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingLineup, setSavingLineup] = useState(false);
  const [startingLive, setStartingLive] = useState(false);
  const [assignFlashSlot, setAssignFlashSlot] = useState<FieldSlotId | null>(null);
  const assignFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [formationId, setFormationId] = useState<U11FormationId>(U11_FORMATION_DB_FALLBACK);
  const [isMobile, setIsMobile] = useState(false);
  const [lineupViewMode, setLineupViewMode] = useState<'pitch' | 'list'>('pitch');
  const [saveToastFading, setSaveToastFading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setMatchLoading(false);
      setMatchError('Keine Match-ID übergeben.');
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      setMatchLoading(true);
      setMatchError(null);
      const { data, error } = await supabase
        .from('matches')
        .select('id, team_season_id, opponent, u11_formation_id')
        .eq('id', matchId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setMatchRow(null);
        setMatchError(error?.message ?? 'Spiel nicht gefunden.');
      } else {
        setMatchRow(data as MatchRowLite);
      }
      setMatchLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const teamSeasonId = matchRow?.team_season_id ?? null;
  const { players, loading: playersLoading, error: playersError } = usePlayers(teamSeasonId);
  const playersById = useMemo(() => {
    const map = new Map<string, (typeof players)[number]>();
    for (const p of players) map.set(p.id, p);
    return map;
  }, [players]);

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setLineupLoading(false);
      setLineupError('Keine Match-ID übergeben.');
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      setLineupLoading(true);
      setLineupError(null);

      const initialSlots = emptySlots();
      let initialSquad = selectedFromState;

      const { data, error } = await fetchLineupForLiveMatch(matchId);
      if (cancelled) return;
      if (error) {
        setLineupError(error);
      } else {
        if (initialSquad.length === 0) {
          initialSquad = data.squadPlayerIds.filter((id, idx, arr) => arr.indexOf(id) === idx);
        }
        const sanitized = sanitizeLineupToMatchSquad(data.startingPlayerIds, initialSquad);
        initialSquad = sanitized.squadPlayerIds;
        for (let i = 0; i < LIVE_FIELD_SLOT_ORDER.length; i += 1) {
          const pid = sanitized.startingPlayerIds[i] ?? null;
          initialSlots[LIVE_FIELD_SLOT_ORDER[i]] = pid && pid.length > 0 ? pid : null;
        }
      }

      setSlots(initialSlots);
      setSquadIds(initialSquad);
      setLineupLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId, selectedFromState, location.key]);

  useEffect(() => {
    if (!matchId || !matchRow) return;
    const fromDb = matchRow.u11_formation_id;
    if (isU11FormationId(fromDb)) {
      setFormationId(fromDb);
      return;
    }
    const stored = readStoredU11Formation(matchId);
    if (stored) {
      setFormationId(stored);
      return;
    }
    setFormationId(U11_FORMATION_DB_FALLBACK);
  }, [matchId, matchRow]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!selectedBankPlayerId) return;
    if (!squadIds.includes(selectedBankPlayerId)) {
      setSelectedBankPlayerId(null);
    }
  }, [selectedBankPlayerId, squadIds]);

  useEffect(() => {
    const squadSet = new Set(squadIds);
    setSlots((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const slot of LIVE_FIELD_SLOT_ORDER) {
        const pid = next[slot];
        if (pid && !squadSet.has(pid)) {
          next[slot] = null;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [squadIds]);

  useEffect(() => {
    return () => {
      if (assignFlashTimerRef.current) clearTimeout(assignFlashTimerRef.current);
    };
  }, []);

  /** Erfolgsmeldung: kurzer Toast mit Fade-out, kein permanenter Block. */
  useEffect(() => {
    if (saveMsg !== 'Aufstellung gespeichert.') {
      setSaveToastFading(false);
      return;
    }
    setSaveToastFading(false);
    const fadeAt = window.setTimeout(() => setSaveToastFading(true), 1000);
    const clearAt = window.setTimeout(() => {
      setSaveMsg(null);
      setSaveToastFading(false);
    }, 1500);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(clearAt);
    };
  }, [saveMsg]);

  const starterCount = useMemo(
    () => LIVE_FIELD_SLOT_ORDER.filter((slot) => Boolean(slots[slot])).length,
    [slots],
  );

  const starterSet = useMemo(() => {
    const set = new Set<string>();
    for (const slot of LIVE_FIELD_SLOT_ORDER) {
      const pid = slots[slot];
      if (pid) set.add(pid);
    }
    return set;
  }, [slots]);

  const bankIds = useMemo(
    () => squadIds.filter((id) => !starterSet.has(id)),
    [squadIds, starterSet],
  );

  const hasSquad = squadIds.length > 0;

  const onTapBankPlayer = (playerId: string) => {
    if (!squadIds.includes(playerId)) return;
    setSelectedBankPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  const onTapSlot = (slot: FieldSlotId) => {
    setSaveMsg(null);
    setSaveError(null);
    const wasOccupied = Boolean(slots[slot]);
    const bankPick = selectedBankPlayerId;
    if (bankPick && !squadIds.includes(bankPick)) {
      setSelectedBankPlayerId(null);
      return;
    }
    setSlots((prev) => {
      const next = { ...prev };
      if (next[slot]) {
        next[slot] = null;
        return next;
      }
      if (!selectedBankPlayerId || !squadIds.includes(selectedBankPlayerId)) return prev;
      for (const s of LIVE_FIELD_SLOT_ORDER) {
        if (next[s] === selectedBankPlayerId) next[s] = null;
      }
      next[slot] = selectedBankPlayerId;
      return next;
    });
    if (!wasOccupied && bankPick) {
      if (assignFlashTimerRef.current) clearTimeout(assignFlashTimerRef.current);
      setAssignFlashSlot(slot);
      assignFlashTimerRef.current = setTimeout(() => {
        setAssignFlashSlot(null);
        assignFlashTimerRef.current = null;
      }, 480);
    }
    if (selectedBankPlayerId) setSelectedBankPlayerId(null);
  };

  const saveLineup = async (): Promise<boolean> => {
    if (!matchId) return false;
    setSaveMsg(null);
    setSaveError(null);
    setSavingLineup(true);
    const ordered = LIVE_FIELD_SLOT_ORDER.map((slot) => slots[slot] ?? null);
    const { error } = await replaceMatchLineupAndBench(matchId, ordered, squadIds);
    if (error) {
      setSavingLineup(false);
      setSaveError(error);
      return false;
    }
    const { error: formationErr } = await updateMatchRow(matchId, { u11_formation_id: formationId });
    setSavingLineup(false);
    if (formationErr) {
      setSaveError(formationErr);
      return false;
    }
    setSaveMsg('Aufstellung gespeichert.');
    return true;
  };

  const onSaveLineupClick = async (): Promise<void> => {
    console.warn('[LINEUP FEED] SAVE BUTTON CLICKED', { matchId });
    if (!matchId) return;
    const saved = await saveLineup();
    if (!saved) return;
    console.warn('[LINEUP FEED] LINEUP SAVE SUCCESS', { matchId });
    if (typeof triggerLineupFeedPostAfterSave !== 'function') {
      console.warn('[LINEUP FEED] save-trigger missing export');
      return;
    }
    void triggerLineupFeedPostAfterSave(matchId).catch((error) => {
      console.warn('[LINEUP FEED] save-trigger error', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  };

  const onStartLive = async () => {
    if (!matchId || starterCount < 7) return;
    setSaveMsg(null);
    setSaveError(null);
    setStartingLive(true);
    const saved = await saveLineup();
    setStartingLive(false);
    if (!saved) {
      return;
    }
    void triggerLineupFeedPostAfterSave(matchId);
    navigate(`/app/live?matchId=${encodeURIComponent(matchId)}`);
  };

  if (matchLoading || lineupLoading) {
    return <div className="min-h-[100dvh] p-4 text-sm text-white/60">Lade Aufstellung…</div>;
  }

  if (matchError || !matchId) {
    return (
      <div className="min-h-[100dvh] p-4 text-white">
        <p className="text-sm text-red-400">{matchError ?? 'Ungültiger Aufruf.'}</p>
        <Link to="/app/termine" className="mt-3 inline-block text-sm font-semibold text-red-300 underline">
          Zurück zu Termine
        </Link>
      </div>
    );
  }

  if (!hasSquad) {
    return (
      <div className={dsPageShellClass('px-4 py-6')}>
        <div className={dsPageAtmosphereClass()} aria-hidden />
        <div className={dsPageContentClass('mx-auto flex max-w-xl flex-col gap-4 rounded-[22px] border border-transparent bg-[rgba(18,18,22,0.92)] p-4 shadow-[0_0_36px_rgba(255,40,40,0.10),inset_0_1px_0_rgba(255,255,255,0.03)]')}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-[36px] w-fit items-center rounded-lg border border-white/15 bg-white/[0.05] px-2.5 text-xs font-semibold text-white/90 hover:bg-white/[0.09]"
          >
            ← Zurück
          </button>
          <h1 className="text-lg font-bold">AUFSTELLUNG</h1>
          <p className="text-sm text-white/70">Bitte zuerst Matchkader in der Match-Vorbereitung auswählen.</p>
          <button
            type="button"
            onClick={() => navigate(`/app/match-preparation?matchId=${encodeURIComponent(matchId)}`)}
            className="min-h-[48px] rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500"
          >
            Zur Match-Vorbereitung
          </button>
          {lineupError ? <p className="text-xs text-red-400">{lineupError}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={dsPageShellClass('relative flex flex-col')}>
      <div className={dsPageAtmosphereClass()} aria-hidden />
      <style>{`@media (max-width: 639px){ nav[aria-label="Hauptnavigation"]{ display:none !important; } }`}</style>

      {saveMsg === 'Aufstellung gespeichert.' ? (
        <div
          className={[
            'pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-[80] w-[min(92vw,20rem)] -translate-x-1/2 rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-center text-xs font-semibold text-emerald-200/95 shadow-lg backdrop-blur-md transition-opacity duration-500 sm:top-[5rem]',
            saveToastFading ? 'opacity-0' : 'opacity-100',
          ].join(' ')}
          role="status"
        >
          {saveMsg}
        </div>
      ) : null}

      <main
        className={dsPageContentClass(
          // Normaler Layout-Flow: Seite scrollt im Body, kein verschachtelter Scroll/overflow-hidden
          // (iOS/iPhone SE: Inhalte sonst abgeschnitten). Scroll-Ende über BottomNav + Safe-Area.
          'live-page-safe-scroll mx-auto flex w-full max-w-xl flex-1 min-h-0 flex-col gap-0 px-4 pt-0.5 sm:pb-[25rem] sm:pt-1',
        )}
      >
        <header className="relative flex min-h-[2.75rem] shrink-0 items-center justify-center px-0 py-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-0 top-1/2 z-[1] inline-flex -translate-y-1/2 items-center gap-0.5 text-sm font-medium text-zinc-300 transition-colors hover:text-zinc-100 active:opacity-80"
            aria-label="Zurück"
          >
            <ChevronLeft className="h-4 w-4 shrink-0 -ml-0.5" strokeWidth={2} />
            <span>Zurück</span>
          </button>
          <h1 className="w-full whitespace-nowrap px-20 text-center text-base font-black uppercase tracking-[0.18em] text-white sm:px-24">
            Aufstellung
          </h1>
        </header>

        <div
          className="mb-2 mt-2 flex h-10 w-full shrink-0 overflow-hidden rounded-[12px] border border-transparent bg-[rgba(18,18,22,0.88)] p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(255,40,40,0.05)]"
          role="tablist"
          aria-label="Aufstellungsansicht"
        >
          <button
            type="button"
            role="tab"
            aria-selected={lineupViewMode === 'list'}
            onClick={() => setLineupViewMode('list')}
            className={dsSegmentTabClass(lineupViewMode === 'list')}
          >
            Liste
          </button>
          <span className="w-px shrink-0 self-stretch bg-[#2a2a2e]/80" aria-hidden />
          <button
            type="button"
            role="tab"
            aria-selected={lineupViewMode === 'pitch'}
            onClick={() => setLineupViewMode('pitch')}
            className={dsSegmentTabClass(lineupViewMode === 'pitch')}
          >
            Spielfeld
          </button>
        </div>

        <div className="-mx-1 mb-2 shrink-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] sm:mx-0">
          <div className="flex min-h-9 flex-nowrap items-center gap-1.5 px-0.5 pb-0.5">
            {U11_FORMATION_CHOICES.map((id) => {
              const active = formationId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFormationId(id);
                    if (matchId) writeStoredU11Formation(matchId, id);
                  }}
                  className={dsFormationTabClass(active)}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>

        {playersError ? <p className="shrink-0 text-sm text-red-400">{playersError}</p> : null}
        {lineupError ? <p className="shrink-0 text-sm text-red-400">{lineupError}</p> : null}
        {saveError ? <p className="shrink-0 text-sm text-red-400">{saveError}</p> : null}

        {lineupViewMode === 'pitch' ? (
          <>
            <section className="relative -mx-1 shrink-0 overflow-hidden rounded-[22px] border border-transparent bg-[rgba(10,10,12,0.55)] shadow-[0_0_32px_rgba(255,40,40,0.06)] sm:mx-0">
              <div className={dsFormationZoneGlowClass()} aria-hidden />
              <span
                className="pointer-events-none absolute right-2 top-2 z-[3] rounded-xl bg-black/65 px-2 py-0.5 text-xs font-bold tabular-nums text-white/90 backdrop-blur-sm"
                aria-label={`Belegte Startplätze ${starterCount} von 7`}
              >
                {starterCount}/7
              </span>
              <div className="overflow-hidden rounded-[11px]">
                <LineupFormationPitch
                  formationId={formationId}
                  slots={slots}
                  interactive
                  onSlotTap={onTapSlot}
                  selectedBankPlayerId={selectedBankPlayerId}
                  assignFlashSlot={assignFlashSlot}
                  className="max-h-[min(70dvh,50rem)] w-full sm:max-h-[min(50rem,78vh)]"
                  renderSlotContent={({ label, labelDx, labelDy, playerId, flash, isGk, emphasize }) => {
                    if (!playerId || !squadIds.includes(playerId)) return null;
                    const player = playersById.get(playerId);
                    if (!player) return null;
                    return (
                      <div className="pointer-events-none">
                        <PitchPlayerMarker
                          lastName={playerFamilyName(player)}
                          number={player.jersey_number}
                          positionBadge={getPositionLabel(label) || label}
                          variant={isGk ? 'goalkeeper' : 'field'}
                          mode="pitch"
                          nameOffsetX={labelDx}
                          nameOffsetY={labelDy}
                          assignFlash={flash}
                          emphasize={emphasize}
                        />
                      </div>
                    );
                  }}
                />
              </div>
            </section>

            <section className="mt-2 shrink-0 border-t border-white/[0.05] pt-1.5">
              <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
                <h2 className={dsSectionLabelClass()}>Ersatzbank</h2>
                <span className="text-[10px] font-medium tabular-nums text-zinc-500">
                  {bankIds.length} {bankIds.length === 1 ? 'Spieler' : 'Spieler'}
                </span>
              </div>
              <div className="-mx-1 overflow-x-auto pb-0.5 pl-0.5 pr-1 [-webkit-overflow-scrolling:touch]">
                <div className="flex min-w-min flex-nowrap items-stretch gap-1.5">
                  {bankIds.map((id) => {
                    const p = playersById.get(id);
                    if (!p) return null;
                    const isSelected = selectedBankPlayerId === id;
                    const posLabel = benchPositionLabel(p);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onTapBankPlayer(id)}
                        className={matchdayBenchTileClass(isSelected)}
                      >
                        <LeibchenJersey
                          lastName={mobileLineupName(playerFamilyName(p))}
                          number={p.jersey_number}
                          position={posLabel}
                          variant={posLabel === 'TW' ? 'goalkeeper' : 'field'}
                          size="compact"
                          className={`${DS_JERSEY_STARTER} shrink-0 opacity-[0.84]`}
                          showBackPrint={false}
                          pitchStyleBack
                          selected={isSelected}
                        />
                        <span className={`mt-1.5 w-full max-w-full px-0.5 text-center ${dsPlayerNameClass()}`}>
                          {premiumPlayerDisplayName(p)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {bankIds.length === 0 ? <p className="px-0.5 text-[10px] text-zinc-500">Keine Spieler auf der Bank.</p> : null}
            </section>
          </>
        ) : (
          <div
            className="flex w-full flex-1 min-h-0 flex-col"
            style={{
              // Resume-sichere Viewport-Höhe (useViewportRecovery) statt 100dvh — iOS/PWA.
              height: isMobile
                ? 'calc(var(--app-visual-vh, var(--app-vh, 1dvh)) * 100 - 6rem - 11.25rem - 5.75rem)'
                : 'calc(var(--app-visual-vh, var(--app-vh, 1dvh)) * 100 - 6rem - 11.25rem - 9.5rem)',
              maxHeight: isMobile
                ? 'calc(var(--app-visual-vh, var(--app-vh, 1dvh)) * 100 - 6rem - 11.25rem - 5.75rem)'
                : 'calc(var(--app-visual-vh, var(--app-vh, 1dvh)) * 100 - 6rem - 11.25rem - 9.5rem)',
            }}
          >
            <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-transparent bg-gradient-to-br from-[#121214] via-[#0a0a0c] to-black p-1.5 shadow-[0_6px_28px_rgba(0,0,0,0.5),0_0_24px_rgba(224,33,41,0.05)] sm:p-2">
              <div className="grid h-full min-h-0 flex-1 grid-cols-2 gap-2">
                <div className="flex min-h-0 min-w-0 flex-col gap-1">
                  <h2 className={`shrink-0 ${dsSectionLabelClass()}`}>Startaufstellung</h2>
                  <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] flex flex-col ${DS_LIST_GAP}`}>
                    {LIVE_FIELD_SLOT_ORDER.map((slot) => {
                      const pid = slots[slot];
                      const p = pid ? playersById.get(pid) : null;
                      const posLabel = getPositionLabel(labelForSlotInFormation(formationId, slot)) || '—';
                      const isGk = slot === 'GK';
                      if (p) {
                        const jerseyName = mobileLineupName(playerFamilyName(p));
                        const fullName = premiumPlayerDisplayName(p);
                        return (
                          <button
                            key={`list-f-${slot}`}
                            type="button"
                            onClick={() => onTapSlot(slot)}
                            className={matchdayLineupListRowClass({ role: 'starter' })}
                          >
                            <div className={matchdayJerseyWrapClass()}>
                              <LeibchenJersey
                                lastName={jerseyName}
                                number={p.jersey_number ?? '–'}
                                position={posLabel}
                                variant={isGk ? 'goalkeeper' : 'field'}
                                size="compact"
                                pitchStyleBack
                                className={`${DS_JERSEY_STARTER} opacity-90`}
                              />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5 pr-1">
                              <p className={dsPlayerNameClass()}>{fullName}</p>
                              <span className="inline-flex w-fit rounded-md border border-transparent bg-[rgba(120,18,28,0.26)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#FF8D98]">
                                {posLabel}
                              </span>
                            </div>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={`list-f-${slot}`}
                          type="button"
                          onClick={() => onTapSlot(slot)}
                          className="flex min-h-[3.25rem] w-full shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-white/12 bg-black/35 px-1.5 py-1 text-center transition-colors active:scale-[0.99] hover:border-white/18"
                        >
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{posLabel}</span>
                          <span className="text-[11px] font-medium text-zinc-500">Frei</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex min-h-0 min-w-0 flex-col gap-1 border-l border-white/[0.08] pl-2">
                  <h2 className={`shrink-0 ${dsSectionLabelClass()}`}>Ersatzbank</h2>
                  <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] flex flex-col ${DS_LIST_GAP}`}>
                    {bankIds.length === 0 ? (
                      <p className="text-xs text-zinc-500">Keine Bankspieler.</p>
                    ) : (
                      bankIds.map((id) => {
                        const p = playersById.get(id);
                        if (!p) return null;
                        const posLabel = benchPositionLabel(p);
                        const shortName = mobileLineupName(playerFamilyName(p));
                        const fullName = premiumPlayerDisplayName(p);
                        const isSelected = selectedBankPlayerId === id;
                        return (
                          <button
                            key={`list-b-${id}`}
                            type="button"
                            onClick={() => onTapBankPlayer(id)}
                            className={matchdayLineupListRowClass({ role: 'bench', selected: isSelected })}
                          >
                            <div className={matchdayJerseyWrapClass()}>
                              <LeibchenJersey
                                lastName={shortName}
                                number={p.jersey_number ?? '–'}
                                position={posLabel}
                                variant={posLabel === 'TW' ? 'goalkeeper' : 'field'}
                                size="compact"
                                pitchStyleBack
                                className={`${DS_JERSEY_STARTER} opacity-90`}
                              />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5 pr-1">
                              <p className={dsPlayerNameClass()}>{fullName}</p>
                              <span className={matchdayLineupPositionBadgeClass('bench')}>
                                Bank
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      <div
        className={dsStickyCtaBarClass()}
        style={{
          bottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 4px)' : 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto flex w-full max-w-xl items-stretch gap-2">
          <button
            type="button"
            disabled={savingLineup || startingLive}
            onClick={() => void onSaveLineupClick()}
            className={`flex h-14 min-h-14 flex-1 items-center justify-center px-2 text-xs font-semibold leading-tight ${dsSecondaryCtaClass()}`}
          >
            {savingLineup ? 'Speichern…' : 'Aufstellung speichern'}
          </button>
          <button
            type="button"
            disabled={starterCount < 7 || savingLineup || startingLive}
            onClick={() => void onStartLive()}
            className={`flex h-14 min-h-14 flex-1 items-center justify-center px-2 text-xs font-bold leading-tight ${dsPrimaryCtaClass()}`}
          >
            {startingLive ? 'Starte…' : 'Zum Liveticker'}
          </button>
        </div>
      </div>
    </div>
  );
};

