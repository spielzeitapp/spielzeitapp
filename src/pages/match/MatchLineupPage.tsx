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
  isFairPlayFormationId,
  labelForSlotInFormation,
  readStoredU11Formation,
  U11_FORMATION_CHOICES,
  FAIRPLAY_FORMATION_CHOICES,
  U11_FORMATION_DB_FALLBACK,
  writeStoredU11Formation,
  type U11FormationId,
} from '../../lib/matchFormations';
import {
  canMutateMatchPreparation,
  friendlyMatchLineupWriteError,
  isMatchSquadEditable,
} from '../../lib/matchPreparationAccess';
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
import { useDemoMode } from '../../demo/DemoContext';
import { useInternalBasePath } from '../../demo/demoPaths';
import { useActiveTeamSeason } from '../../hooks/useActiveTeamSeason';
import { normalizeRole } from '../../lib/roles';
import {
  cloneMatchLineupVariant,
  readMatchLineupVariants,
  writeMatchLineupVariants,
  type MatchLineupVariantDraft,
  type MatchLineupVariantNumber,
} from '../../lib/matchLineupVariants';

type MatchRowLite = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  u11_formation_id: string | null;
};

type LocationState = {
  selectedPlayers?: string[];
  formationId?: string;
  lineupCopiedFromPrevious?: boolean;
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
  const demo = useDemoMode();
  const isDemo = Boolean(demo);
  const basePath = useInternalBasePath();
  const { role: roleFromHook } = useActiveTeamSeason();
  const canManage = isDemo || canMutateMatchPreparation(normalizeRole(roleFromHook));
  const routeState = (location.state ?? null) as LocationState;
  const selectedFromState = useMemo(
    () => [...new Set((routeState?.selectedPlayers ?? []).map((id) => normalizeId(id)).filter((id): id is string => Boolean(id)))],
    [routeState?.selectedPlayers],
  );

  const [matchRow, setMatchRow] = useState<MatchRowLite | null>(null);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);
  const [matchLiveStartedAt, setMatchLiveStartedAt] = useState<string | null>(null);
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
  const [visibleVariant, setVisibleVariant] = useState<MatchLineupVariantNumber>(1);
  const [startVariant, setStartVariant] = useState<MatchLineupVariantNumber>(1);
  const [variantDrafts, setVariantDrafts] = useState<
    Record<MatchLineupVariantNumber, MatchLineupVariantDraft> | null
  >(null);
  const initializedVariantsForMatchRef = useRef<string | null>(null);

  // Status + Rolle: Eltern/Fans niemals editierbar (auch bei direktem Route-Aufruf).
  const lineupEditable =
    canManage &&
    isMatchSquadEditable({
      status: matchStatus,
      live_started_at: matchLiveStartedAt,
    });

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setMatchLoading(false);
      setMatchError('Keine Match-ID übergeben.');
      return () => {
        cancelled = true;
      };
    }

    if (isDemo && demo) {
      const lite = demo.getDemoMatch(matchId);
      if (!lite) {
        setMatchRow(null);
        setMatchStatus(null);
        setMatchLiveStartedAt(null);
        setMatchError('Spiel nicht gefunden.');
        setMatchLoading(false);
        return () => {
          cancelled = true;
        };
      }
      setMatchRow({
        id: lite.id,
        team_season_id: lite.team_season_id,
        opponent: lite.opponent,
        u11_formation_id: lite.u11_formation_id,
      });
      setMatchStatus(lite.status);
      setMatchLiveStartedAt(lite.live_started_at);
      setMatchError(null);
      setMatchLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      setMatchLoading(true);
      setMatchError(null);
      const { data, error } = await supabase
        .from('matches')
        .select('id, team_season_id, opponent, u11_formation_id, status, live_started_at')
        .eq('id', matchId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setMatchRow(null);
        setMatchStatus(null);
        setMatchLiveStartedAt(null);
        setMatchError(error?.message ?? 'Spiel nicht gefunden.');
      } else {
        const row = data as MatchRowLite & { status?: string | null; live_started_at?: string | null };
        setMatchRow({
          id: row.id,
          team_season_id: row.team_season_id,
          opponent: row.opponent,
          u11_formation_id: row.u11_formation_id,
        });
        setMatchStatus(row.status ?? null);
        setMatchLiveStartedAt(row.live_started_at ?? null);
      }
      setMatchLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, isDemo, demo]);

  const teamSeasonId = matchRow?.team_season_id ?? null;
  const { players: livePlayers, loading: playersLoadingLive, error: playersErrorLive } = usePlayers(
    isDemo ? null : teamSeasonId,
  );
  const players = isDemo && demo ? demo.players : livePlayers;
  const playersLoading = isDemo ? false : playersLoadingLive;
  const playersError = isDemo ? null : playersErrorLive;
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

    if (isDemo && demo) {
      const prep = demo.getDemoMatchPrep(matchId);
      if (!prep) {
        setLineupError('Spiel nicht gefunden.');
        setLineupLoading(false);
        return () => {
          cancelled = true;
        };
      }
      const initialSlots = emptySlots();
      let initialSquad =
        selectedFromState.length > 0 ? selectedFromState : [...prep.squadPlayerIds];
      const startingFromPrep = LIVE_FIELD_SLOT_ORDER.map((slot) => prep.slots[slot] ?? null);
      const sanitized = sanitizeLineupToMatchSquad(startingFromPrep, initialSquad);
      initialSquad = sanitized.squadPlayerIds;
      for (let i = 0; i < LIVE_FIELD_SLOT_ORDER.length; i += 1) {
        const pid = sanitized.startingPlayerIds[i] ?? null;
        initialSlots[LIVE_FIELD_SLOT_ORDER[i]] = pid && pid.length > 0 ? pid : null;
      }
      setSlots(initialSlots);
      setSquadIds(initialSquad);
      setFormationId(prep.formationId);
      setLineupError(null);
      setLineupLoading(false);
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
        // Nach Copy: Squad immer Union aus Feld + Bank + ggf. Navigation-State,
        // damit sanitize keine Starter gegen leeres Squad streicht.
        const fieldIds = data.startingPlayerIds
          .map((id) => String(id ?? '').trim())
          .filter((id) => id.length > 0);
        const benchIdsLoaded = data.savedBenchPlayerIds
          .map((id) => String(id ?? '').trim())
          .filter((id) => id.length > 0);
        initialSquad = [...new Set([...initialSquad, ...fieldIds, ...benchIdsLoaded])];
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
  }, [matchId, selectedFromState, location.key, isDemo, demo]);

  useEffect(() => {
    if (!matchId || !matchRow) return;
    if (isDemo && demo) {
      const prep = demo.getDemoMatchPrep(matchId);
      if (prep) {
        setFormationId(prep.formationId);
        return;
      }
    }
    const fromState = routeState?.formationId;
    if (isU11FormationId(fromState)) {
      setFormationId(fromState);
      writeStoredU11Formation(matchId, fromState);
      return;
    }
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
  }, [matchId, matchRow, isDemo, demo, routeState?.formationId]);

  useEffect(() => {
    if (!routeState?.lineupCopiedFromPrevious) return;
    setSaveMsg('Aufstellung vom letzten Spiel übernommen');
  }, [routeState?.lineupCopiedFromPrevious, matchId]);

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
    // Leerer Kader vor dem Lineup-Load darf befüllte Slots nicht ausleeren
    // (sonst Race: setSlots(seed) + setSquadIds im selben Tick, Clear sieht noch []).
    if (lineupLoading || squadIds.length === 0) return;
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
  }, [squadIds, lineupLoading]);

  useEffect(() => {
    return () => {
      if (assignFlashTimerRef.current) clearTimeout(assignFlashTimerRef.current);
    };
  }, []);

  /** Erfolgsmeldung: kurzer Toast mit Fade-out, kein permanenter Block. */
  useEffect(() => {
    if (!saveMsg) {
      setSaveToastFading(false);
      return;
    }
    setSaveToastFading(false);
    const fadeAt = window.setTimeout(() => setSaveToastFading(true), 1400);
    const clearAt = window.setTimeout(() => {
      setSaveMsg(null);
      setSaveToastFading(false);
    }, 2000);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(clearAt);
    };
  }, [saveMsg]);

  const captureVisibleVariant = (): MatchLineupVariantDraft => ({
    slots: { ...slots },
    squadIds: [...squadIds],
    formationId,
  });

  useEffect(() => {
    if (!matchId || lineupLoading || initializedVariantsForMatchRef.current === matchId) return;
    initializedVariantsForMatchRef.current = matchId;
    const canonical = captureVisibleVariant();
    const stored = readMatchLineupVariants(matchId);
    if (stored) {
      const selected = stored.startVariant;
      const selectedDraft = cloneMatchLineupVariant(stored.variants[selected]);
      setVariantDrafts({
        1: cloneMatchLineupVariant(stored.variants[1]),
        2: cloneMatchLineupVariant(stored.variants[2]),
      });
      setStartVariant(selected);
      setVisibleVariant(selected);
      setSlots(selectedDraft.slots);
      setSquadIds(selectedDraft.squadIds);
      setFormationId(selectedDraft.formationId);
      return;
    }
    const initial = {
      1: cloneMatchLineupVariant(canonical),
      2: cloneMatchLineupVariant(canonical),
    };
    setVariantDrafts(initial);
    writeMatchLineupVariants(matchId, { version: 1, startVariant: 1, variants: initial });
  // Der Effekt initialisiert genau einmal je Match nach dem kanonischen Lineup-Load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, lineupLoading]);

  const persistVariantDrafts = (
    nextDrafts: Record<MatchLineupVariantNumber, MatchLineupVariantDraft>,
    nextStartVariant = startVariant,
  ) => {
    if (!matchId) return;
    writeMatchLineupVariants(matchId, {
      version: 1,
      startVariant: nextStartVariant,
      variants: nextDrafts,
    });
  };

  const onSelectVariant = (nextVariant: MatchLineupVariantNumber) => {
    if (nextVariant === visibleVariant) return;
    const currentDraft = captureVisibleVariant();
    const fallbackDraft = cloneMatchLineupVariant(currentDraft);
    const nextDrafts = variantDrafts
      ? {
          1: cloneMatchLineupVariant(variantDrafts[1]),
          2: cloneMatchLineupVariant(variantDrafts[2]),
        }
      : { 1: cloneMatchLineupVariant(fallbackDraft), 2: cloneMatchLineupVariant(fallbackDraft) };
    nextDrafts[visibleVariant] = cloneMatchLineupVariant(currentDraft);
    const target = cloneMatchLineupVariant(nextDrafts[nextVariant] ?? fallbackDraft);
    setVariantDrafts(nextDrafts);
    persistVariantDrafts(nextDrafts);
    setVisibleVariant(nextVariant);
    setSlots(target.slots);
    setSquadIds(target.squadIds);
    setFormationId(target.formationId);
    setSelectedBankPlayerId(null);
    setSaveMsg(null);
    setSaveError(null);
  };

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

  const formationChoices = useMemo(
    () => (isFairPlayFormationId(formationId) ? [...FAIRPLAY_FORMATION_CHOICES] : [...U11_FORMATION_CHOICES]),
    [formationId],
  );

  const onTapBankPlayer = (playerId: string) => {
    if (!lineupEditable) return;
    if (!squadIds.includes(playerId)) return;
    setSelectedBankPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  const onTapSlot = (slot: FieldSlotId) => {
    if (!lineupEditable) return;
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
    if (!canManage) {
      setSaveError('Keine Berechtigung zum Speichern der Aufstellung.');
      return false;
    }
    if (!lineupEditable) {
      setSaveError('Aufstellung kann in diesem Spielstatus nicht bearbeitet werden.');
      return false;
    }
    setSaveMsg(null);
    setSaveError(null);
    setSavingLineup(true);

    const currentDraft = captureVisibleVariant();
    const nextDrafts = variantDrafts
      ? {
          1: cloneMatchLineupVariant(variantDrafts[1]),
          2: cloneMatchLineupVariant(variantDrafts[2]),
        }
      : { 1: cloneMatchLineupVariant(currentDraft), 2: cloneMatchLineupVariant(currentDraft) };
    nextDrafts[visibleVariant] = cloneMatchLineupVariant(currentDraft);
    setVariantDrafts(nextDrafts);
    persistVariantDrafts(nextDrafts);

    if (visibleVariant !== startVariant) {
      setSavingLineup(false);
      setSaveMsg(`Variante ${visibleVariant} gespeichert.`);
      return true;
    }

    if (isDemo && demo) {
      demo.setDemoMatchLineup(matchId, slots, squadIds, formationId);
      setSavingLineup(false);
      setSaveMsg('Aufstellung gespeichert.');
      return true;
    }

    const ordered = LIVE_FIELD_SLOT_ORDER.map((slot) => slots[slot] ?? null);
    const { error } = await replaceMatchLineupAndBench(matchId, ordered, squadIds);
    if (error) {
      setSavingLineup(false);
      setSaveError(friendlyMatchLineupWriteError(error));
      console.warn('[MatchLineup] save failed', { matchId, error });
      return false;
    }
    const { error: formationErr } = await updateMatchRow(matchId, { u11_formation_id: formationId });
    setSavingLineup(false);
    if (formationErr) {
      setSaveError(friendlyMatchLineupWriteError(formationErr));
      console.warn('[MatchLineup] formation save failed', { matchId, error: formationErr });
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
    if (visibleVariant !== startVariant) return;
    console.warn('[LINEUP FEED] LINEUP SAVE SUCCESS', { matchId });
    if (isDemo) {
      demo?.setDemoMatchPublishedLocal(matchId, true);
      return;
    }
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

  const onUseAsStartVariant = async (): Promise<void> => {
    if (!matchId || !lineupEditable || visibleVariant === startVariant) return;
    setSaveMsg(null);
    setSaveError(null);
    setSavingLineup(true);
    const currentDraft = captureVisibleVariant();
    const nextDrafts = variantDrafts
      ? {
          1: cloneMatchLineupVariant(variantDrafts[1]),
          2: cloneMatchLineupVariant(variantDrafts[2]),
        }
      : { 1: cloneMatchLineupVariant(currentDraft), 2: cloneMatchLineupVariant(currentDraft) };
    nextDrafts[visibleVariant] = cloneMatchLineupVariant(currentDraft);

    if (isDemo && demo) {
      demo.setDemoMatchLineup(matchId, slots, squadIds, formationId);
    } else {
      const ordered = LIVE_FIELD_SLOT_ORDER.map((slot) => slots[slot] ?? null);
      const { error } = await replaceMatchLineupAndBench(matchId, ordered, squadIds);
      if (error) {
        setSavingLineup(false);
        setSaveError(friendlyMatchLineupWriteError(error));
        return;
      }
      const { error: formationErr } = await updateMatchRow(matchId, { u11_formation_id: formationId });
      if (formationErr) {
        setSavingLineup(false);
        setSaveError(friendlyMatchLineupWriteError(formationErr));
        return;
      }
    }

    setVariantDrafts(nextDrafts);
    setStartVariant(visibleVariant);
    persistVariantDrafts(nextDrafts, visibleVariant);
    setSavingLineup(false);
    setSaveMsg(`Variante ${visibleVariant} als Startaufstellung gewählt.`);
    if (!isDemo) void triggerLineupFeedPostAfterSave(matchId);
  };

  const onStartLive = async () => {
    if (!matchId || starterCount < 7 || !canManage || !lineupEditable) return;
    setSaveMsg(null);
    setSaveError(null);
    setStartingLive(true);
    const saved = await saveLineup();
    setStartingLive(false);
    if (!saved) {
      return;
    }
    if (isDemo) {
      // Lokale Live-Session aus der gespeicherten Aufstellung aufbauen (Status bleibt „scheduled“ bis Anpfiff).
      demo?.startDemoLiveMatch(matchId, { slots, squadPlayerIds: squadIds, formationId });
      navigate(`${basePath}/live?matchId=${encodeURIComponent(matchId)}`);
      return;
    }
    void triggerLineupFeedPostAfterSave(matchId);
    navigate(`${basePath}/live?matchId=${encodeURIComponent(matchId)}`);
  };

  if (matchLoading || lineupLoading || playersLoading) {
    return <div className="min-h-[100dvh] p-4 text-sm text-white/60">Lade Aufstellung…</div>;
  }

  if (matchError || !matchId) {
    return (
      <div className="min-h-[100dvh] p-4 text-white">
        <p className="text-sm text-red-400">{matchError ?? 'Ungültiger Aufruf.'}</p>
        <Link to={`${basePath}/termine`} className="mt-3 inline-block text-sm font-semibold text-red-300 underline">
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
          <p className="text-sm text-white/70">
            {canManage
              ? 'Bitte zuerst Matchkader in der Match-Vorbereitung auswählen.'
              : 'Für dieses Spiel ist noch keine Aufstellung veröffentlicht.'}
          </p>
          {canManage ? (
            <button
              type="button"
              onClick={() => navigate(`${basePath}/match-preparation?matchId=${encodeURIComponent(matchId)}`)}
              className="min-h-[48px] rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500"
            >
              Zur Match-Vorbereitung
            </button>
          ) : (
            <Link to={`${basePath}/termine`} className="text-sm font-semibold text-red-300 underline">
              Zurück zu Termine
            </Link>
          )}
          {lineupError ? <p className="text-xs text-red-400">{lineupError}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={dsPageShellClass('relative flex flex-col')}>
      <div className={dsPageAtmosphereClass()} aria-hidden />
      <style>{`@media (max-width: 639px){
        nav[aria-label="Hauptnavigation"], .app-header { display:none !important; }
        main.appMain { padding-top: env(safe-area-inset-top, 0px) !important; }
      }`}</style>

      {saveMsg ? (
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
          'live-page-safe-scroll mx-auto flex w-full max-w-xl flex-1 min-h-0 flex-col gap-0 px-1.5 pt-0 sm:px-4 sm:pb-[25rem] sm:pt-1',
        )}
      >
        <header className="relative flex min-h-[2.5rem] shrink-0 items-center justify-center px-1 py-1.5 sm:min-h-[2.75rem] sm:py-2">
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

        {canManage ? (
          <div
            className="mb-1 mt-0.5 grid h-11 w-full shrink-0 grid-cols-2 gap-1.5 sm:mt-1 sm:h-12"
            role="tablist"
            aria-label="Aufstellungsvarianten"
          >
            {([1, 2] as const).map((variant) => {
              const active = visibleVariant === variant;
              const isStart = startVariant === variant;
              return (
                <button
                  key={variant}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelectVariant(variant)}
                  className={[
                    'flex min-h-11 flex-col items-center justify-center rounded-xl border text-xs font-bold transition-colors',
                    active
                      ? 'border-red-500/80 bg-red-950/45 text-white shadow-[0_0_18px_rgba(224,33,41,0.10)]'
                      : 'border-white/10 bg-white/[0.035] text-white/55',
                  ].join(' ')}
                >
                  <span>Variante {variant}</span>
                  <span className={isStart ? 'text-[9px] font-bold uppercase tracking-wider text-emerald-400' : 'text-[9px] font-medium uppercase tracking-wider text-white/30'}>
                    {isStart ? 'Startaufstellung' : 'Alternative'}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          className="mb-1 mt-1 flex h-9 w-full shrink-0 overflow-hidden rounded-[12px] border border-transparent bg-[rgba(18,18,22,0.88)] p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(255,40,40,0.05)] sm:mb-2 sm:mt-2 sm:h-10"
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

        <div className="-mx-0.5 mb-1 shrink-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] sm:mx-0 sm:mb-2">
          <div className="flex min-h-9 flex-nowrap items-center gap-1.5 px-0.5 pb-0.5">
            {canManage
              ? formationChoices.map((id) => {
                  const active = formationId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!lineupEditable}
                      onClick={() => {
                        if (!lineupEditable) return;
                        setFormationId(id);
                        if (matchId) {
                          if (isDemo && demo) demo.setDemoMatchFormation(matchId, id);
                          else writeStoredU11Formation(matchId, id);
                        }
                      }}
                      className={dsFormationTabClass(active)}
                    >
                      {id}
                    </button>
                  );
                })
              : (
                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-bold tabular-nums text-white/80">
                  Formation {formationId}
                </span>
              )}
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
                  displayMode="lineup-fullscreen"
                  slots={slots}
                  interactive={lineupEditable}
                  onSlotTap={onTapSlot}
                  selectedBankPlayerId={selectedBankPlayerId}
                  assignFlashSlot={assignFlashSlot}
                  className="w-full"
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
                          fullscreenLineup
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

      {canManage ? (
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
            disabled={!lineupEditable || savingLineup || startingLive}
            onClick={() => void onSaveLineupClick()}
            className={`flex h-14 min-h-14 flex-1 items-center justify-center px-2 text-xs font-semibold leading-tight ${dsSecondaryCtaClass()}`}
          >
            {savingLineup ? 'Speichern…' : 'Aufstellung speichern'}
          </button>
          <button
            type="button"
            disabled={!lineupEditable || starterCount < 7 || savingLineup || startingLive}
            onClick={() => void (visibleVariant === startVariant ? onStartLive() : onUseAsStartVariant())}
            className={`flex h-14 min-h-14 flex-1 items-center justify-center px-2 text-xs font-bold leading-tight ${dsPrimaryCtaClass()}`}
          >
            {startingLive
              ? 'Start…'
              : visibleVariant !== startVariant
                ? 'Als Start wählen'
                : isDemo
                  ? 'LIVE (Demo)'
                  : 'Spiel starten'}
          </button>
        </div>
        {!lineupEditable ? (
          <p className="mx-auto mt-1 max-w-xl text-center text-[11px] text-white/45">
            Abgeschlossenes Spiel – Aufstellung nur lesbar.
          </p>
        ) : isDemo ? (
          <p className="mx-auto mt-1 max-w-xl text-center text-[11px] text-white/45">
            Lokal speichern · LIVE ohne Push oder Feed
          </p>
        ) : null}
      </div>
      ) : (
        <p className="mx-auto mb-4 max-w-xl px-4 text-center text-[11px] text-white/45">
          Nur Ansicht – Bearbeitung nur für Trainer.
        </p>
      )}
    </div>
  );
};
