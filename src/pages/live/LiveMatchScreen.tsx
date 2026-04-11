import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../../auth/useSession';
import { usePlayers } from '../../hooks/usePlayers';
import { useMatchTimer } from '../../hooks/useMatchTimer';
import {
  calculatePlayerPlaytimes,
  getBenchPlayers,
  getCurrentOnFieldPlayers,
  getPlaytimeStatus,
  handleSubstitution,
  type MatchEngineEvent,
  type MatchEventType,
} from '../../lib/matchEngine';
import { LIVE_MATCH_SETUP_STORAGE_KEY, type LiveMatchSetupPayload } from '../../lib/liveMatchSetup';
import { playerItemToRoster, type RosterPlayer } from '../../lib/rosterPlayer';

const HOME_FALLBACK = 'Unser Team';

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMinute(ts: number): string {
  const min = Math.floor(ts / 60);
  return `${min}'`;
}

const tabBtn =
  'flex-1 min-h-[44px] rounded-xl px-2 text-sm font-semibold transition-colors active:scale-[0.98]';
const tabActive = 'bg-emerald-600 text-white shadow-inner';
const tabIdle = 'bg-white/5 text-white/70 hover:bg-white/10';

function eventIcon(t: MatchEventType): string {
  if (t === 'goal') return '⚽';
  if (t === 'sub_out' || t === 'sub_in') return '🔁';
  if (t === 'start') return '▶';
  if (t === 'pause') return '⏸';
  if (t === 'resume') return '▶';
  if (t === 'end') return '⏹';
  return '•';
}

function newEventId(): string {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type EventsFilter = 'all' | 'goals' | 'subs';

function sortRosterByNumber(list: RosterPlayer[]): RosterPlayer[] {
  return [...list].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
}

export const LiveMatchScreen: React.FC = () => {
  const { selectedTeamSeasonId, selectedTeamSeason } = useSession();
  const { players, loading: playersLoading, error: playersError } = usePlayers(selectedTeamSeasonId);

  const roster = useMemo(() => sortRosterByNumber(players.map(playerItemToRoster)), [players]);
  const rosterById = useMemo(() => {
    const m = new Map<string, RosterPlayer>();
    roster.forEach((p) => m.set(p.id, p));
    return m;
  }, [roster]);

  const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
  const [startingPlayerIds, setStartingPlayerIds] = useState<string[]>([]);
  const [events, setEvents] = useState<MatchEngineEvent[]>([]);
  const [opponentLabel, setOpponentLabel] = useState('Gegner');
  const setupAppliedRef = useRef(false);

  const {
    currentMatchSeconds,
    isRunning,
    matchHasEnded,
    half,
    startMatch,
    pauseMatch,
    resumeMatch,
    endMatch,
    startSecondHalf,
  } = useMatchTimer();

  useEffect(() => {
    setupAppliedRef.current = false;
  }, [selectedTeamSeasonId]);

  useEffect(() => {
    if (players.length === 0) {
      setSquadPlayerIds([]);
      setStartingPlayerIds([]);
      return;
    }

    const valid = new Set(players.map((p) => p.id));

    if (!setupAppliedRef.current) {
      setupAppliedRef.current = true;

      let squad = players.map((p) => p.id);
      let starting = players.slice(0, Math.min(7, players.length)).map((p) => p.id);
      const raw = sessionStorage.getItem(LIVE_MATCH_SETUP_STORAGE_KEY);

      if (raw) {
        try {
          const p = JSON.parse(raw) as LiveMatchSetupPayload;
          if (p.opponent?.trim()) setOpponentLabel(p.opponent.trim());

          if (p.squadPlayerIds?.length) {
            const f = p.squadPlayerIds.filter((id) => valid.has(id));
            if (f.length > 0) squad = f;
          }
          if (p.startingPlayerIds?.length === 7) {
            const st = p.startingPlayerIds.filter((id) => squad.includes(id));
            if (st.length === 7) starting = st;
          }
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem(LIVE_MATCH_SETUP_STORAGE_KEY);
      }

      setSquadPlayerIds(squad);
      setStartingPlayerIds(starting.slice(0, 7));
      return;
    }

    setSquadPlayerIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length > 0 ? next : [...valid];
    });
    setStartingPlayerIds((prev) => prev.filter((id) => valid.has(id)));
  }, [players]);

  const homeName = selectedTeamSeason?.team?.name ?? HOME_FALLBACK;

  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);
  const [mainTab, setMainTab] = useState<'overview' | 'lineup' | 'events' | 'time'>('overview');
  const [eventsFilter, setEventsFilter] = useState<EventsFilter>('all');

  const [subOpen, setSubOpen] = useState(false);
  const [subOutId, setSubOutId] = useState<string>('');
  const [subInId, setSubInId] = useState<string>('');

  const [wechselOutId, setWechselOutId] = useState<string>('');
  const [wechselInId, setWechselInId] = useState<string>('');

  const hasClockStarted = useMemo(() => events.some((e) => e.type === 'start'), [events]);

  const onFieldIds = useMemo(
    () => getCurrentOnFieldPlayers(startingPlayerIds, events, currentMatchSeconds),
    [startingPlayerIds, events, currentMatchSeconds],
  );

  const fieldPlayers = useMemo(() => {
    const set = new Set(onFieldIds);
    return sortRosterByNumber(roster.filter((p) => set.has(p.id)));
  }, [onFieldIds, roster]);

  const benchPlayers = useMemo(() => {
    const ids = getBenchPlayers(squadPlayerIds, onFieldIds);
    const set = new Set(ids);
    return sortRosterByNumber(roster.filter((p) => set.has(p.id)));
  }, [squadPlayerIds, onFieldIds, roster]);

  const playtimes = useMemo(
    () => calculatePlayerPlaytimes(startingPlayerIds, squadPlayerIds, events, currentMatchSeconds),
    [startingPlayerIds, squadPlayerIds, events, currentMatchSeconds],
  );

  const pushEvents = useCallback((evs: MatchEngineEvent[]) => {
    setEvents((prev) => [...evs, ...prev]);
  }, []);

  const pushSingle = useCallback(
    (partial: Omit<MatchEngineEvent, 'id'>) => {
      const row: MatchEngineEvent = { ...partial, id: newEventId() };
      pushEvents([row]);
    },
    [pushEvents],
  );

  const onStartClick = () => {
    if (matchHasEnded || isRunning) return;
    if (!hasClockStarted) {
      pushSingle({ type: 'start', timestamp: 0 });
      startMatch();
    } else {
      pushSingle({ type: 'resume', timestamp: currentMatchSeconds });
      resumeMatch();
    }
  };

  const onPauseClick = () => {
    if (!isRunning || matchHasEnded) return;
    pushSingle({ type: 'pause', timestamp: currentMatchSeconds });
    pauseMatch();
  };

  const onEndClick = () => {
    if (matchHasEnded) return;
    pushSingle({ type: 'end', timestamp: currentMatchSeconds });
    endMatch();
  };

  const openSubFromPlayer = (p: RosterPlayer) => {
    setSubOpen(true);
    if (onFieldIds.includes(p.id)) {
      setSubOutId(p.id);
      setSubInId('');
    } else {
      setSubInId(p.id);
      setSubOutId('');
    }
  };

  const confirmSub = () => {
    const result = handleSubstitution({
      outgoingPlayerId: subOutId,
      incomingPlayerId: subInId,
      currentTimestamp: currentMatchSeconds,
      events,
      currentOnFieldPlayerIds: onFieldIds,
      generateId: newEventId,
    });
    if (!result.ok) return;
    pushEvents([...result.events].reverse());
    setSubOpen(false);
    setSubOutId('');
    setSubInId('');
  };

  const confirmWechselSection = () => {
    const result = handleSubstitution({
      outgoingPlayerId: wechselOutId,
      incomingPlayerId: wechselInId,
      currentTimestamp: currentMatchSeconds,
      events,
      currentOnFieldPlayerIds: onFieldIds,
      generateId: newEventId,
    });
    if (!result.ok) return;
    pushEvents([...result.events].reverse());
    setWechselOutId('');
    setWechselInId('');
  };

  const filteredEvents = useMemo(() => {
    const list = [...events].sort((a, b) => b.timestamp - a.timestamp);
    if (eventsFilter === 'goals') return list.filter((e) => e.type === 'goal');
    if (eventsFilter === 'subs') return list.filter((e) => e.type === 'sub_out' || e.type === 'sub_in');
    return list;
  }, [events, eventsFilter]);

  const eventLabel = (ev: MatchEngineEvent): string => {
    const name = ev.playerId ? rosterById.get(ev.playerId)?.name : undefined;
    switch (ev.type) {
      case 'start':
        return 'Anpfiff';
      case 'goal':
        return `Tor${name ? ` · ${name}` : ''}`;
      case 'sub_out':
        return `Raus${name ? `: ${name}` : ''}`;
      case 'sub_in':
        return `Rein${name ? `: ${name}` : ''}`;
      case 'pause':
        return 'Pause';
      case 'resume':
        return 'Weiter';
      case 'end':
        return 'Spielende';
      default:
        return ev.type;
    }
  };

  const selectClass =
    'mt-1 w-full min-h-[52px] rounded-2xl border border-white/15 bg-black/50 px-3 text-base text-white focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/40';

  const ampelDot = (s: ReturnType<typeof getPlaytimeStatus>) =>
    s === 'red' ? 'bg-red-500' : s === 'yellow' ? 'bg-amber-400' : 'bg-emerald-500';

  if (playersLoading && roster.length === 0) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] text-white">
        <p className="text-sm text-white/60">Kader wird geladen…</p>
      </div>
    );
  }

  if (playersError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-2 bg-[#0a0a0a] px-4 text-center text-white">
        <p className="text-sm text-red-400">{playersError}</p>
        <p className="text-xs text-white/50">Spieler kommen aus der Tabelle „players“ (aktuelle Mannschaftssaison).</p>
      </div>
    );
  }

  if (!selectedTeamSeasonId || roster.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-2 bg-[#0a0a0a] px-4 text-center text-white">
        <p className="text-sm text-white/70">Kein Team / keine Spieler.</p>
        <p className="text-xs text-white/45">Wähle eine Mannschaftssaison oder lege Spieler im Team an.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] pb-28 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f0f0f]/95 px-3 pt-3 pb-4 backdrop-blur-md">
        <div className="mx-auto max-w-lg">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-white/50">Live</p>
          <h1 className="mt-1 text-center text-base font-bold leading-tight sm:text-lg">
            {homeName} <span className="text-white/40">vs</span> {opponentLabel}
          </h1>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-4xl font-black tabular-nums text-white sm:text-5xl">{scoreHome}</span>
            <span className="text-2xl font-light text-white/40">:</span>
            <span className="text-4xl font-black tabular-nums text-white sm:text-5xl">{scoreAway}</span>
          </div>
          <p className="mt-2 text-center text-sm font-semibold text-emerald-400/90">{half}. Halbzeit</p>
          <div
            className={`mt-2 text-center text-3xl font-mono font-bold tabular-nums sm:text-4xl ${
              isRunning ? 'text-emerald-400' : 'text-white/60'
            }`}
          >
            {formatClock(currentMatchSeconds)}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const scorer = fieldPlayers[0];
                setScoreHome((s) => s + 1);
                pushSingle({
                  type: 'goal',
                  timestamp: currentMatchSeconds,
                  playerId: scorer?.id,
                });
              }}
              className="min-h-[44px] flex-1 rounded-xl bg-white/10 py-2 text-sm font-bold text-emerald-400 active:bg-white/15"
            >
              + Tor Heim
            </button>
            <button
              type="button"
              onClick={() => {
                setScoreAway((s) => s + 1);
                pushSingle({
                  type: 'goal',
                  timestamp: currentMatchSeconds,
                });
              }}
              className="min-h-[44px] flex-1 rounded-xl bg-white/10 py-2 text-sm font-bold text-amber-200/90 active:bg-white/15"
            >
              + Tor Gast
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onStartClick}
              disabled={isRunning || matchHasEnded}
              className="min-h-[48px] flex-1 rounded-2xl bg-emerald-600 px-3 text-base font-bold text-white shadow-lg shadow-emerald-900/40 disabled:opacity-40 active:scale-[0.98]"
            >
              {!hasClockStarted ? 'Anpfiff' : 'Weiter'}
            </button>
            <button
              type="button"
              onClick={onPauseClick}
              disabled={!isRunning || matchHasEnded}
              className="min-h-[48px] flex-1 rounded-2xl bg-amber-600 px-3 text-base font-bold text-white disabled:opacity-40 active:scale-[0.98]"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={onEndClick}
              disabled={matchHasEnded}
              className="min-h-[48px] flex-1 rounded-2xl bg-red-700 px-3 text-base font-bold text-white disabled:opacity-40 active:scale-[0.98]"
            >
              Ende
            </button>
          </div>
          <button
            type="button"
            onClick={startSecondHalf}
            disabled={matchHasEnded}
            className="mt-2 w-full min-h-[40px] rounded-xl border border-white/15 text-sm font-semibold text-white/70 active:bg-white/5 disabled:opacity-35"
          >
            2. Halbzeit (Uhr ≥ 25:00)
          </button>
        </div>
      </header>

      <div className="sticky top-[var(--live-header-h,auto)] z-30 border-b border-white/10 bg-[#0a0a0a] px-3 py-3">
        <div className="mx-auto flex max-w-lg gap-1 rounded-2xl bg-white/5 p-1">
          <button
            type="button"
            className={`${tabBtn} ${mainTab === 'overview' ? tabActive : tabIdle}`}
            onClick={() => setMainTab('overview')}
          >
            Übersicht
          </button>
          <button
            type="button"
            className={`${tabBtn} ${mainTab === 'lineup' ? tabActive : tabIdle}`}
            onClick={() => setMainTab('lineup')}
          >
            Aufstellung
          </button>
          <button
            type="button"
            className={`${tabBtn} ${mainTab === 'events' ? tabActive : tabIdle}`}
            onClick={() => setMainTab('events')}
          >
            Events
          </button>
          <button
            type="button"
            className={`${tabBtn} ${mainTab === 'time' ? tabActive : tabIdle}`}
            onClick={() => setMainTab('time')}
          >
            Zeit
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-3 py-4">
        {mainTab === 'overview' && (
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Wechsel</h2>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-red-400/90" htmlFor="wechsel-raus">
                    Raus
                  </label>
                  <select
                    id="wechsel-raus"
                    className={selectClass}
                    value={wechselOutId}
                    onChange={(e) => setWechselOutId(e.target.value)}
                  >
                    <option value="">Spieler wählen…</option>
                    {fieldPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number} · {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-emerald-400/90" htmlFor="wechsel-rein">
                    Rein
                  </label>
                  <select
                    id="wechsel-rein"
                    className={selectClass}
                    value={wechselInId}
                    onChange={(e) => setWechselInId(e.target.value)}
                  >
                    <option value="">Spieler wählen…</option>
                    {benchPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number} · {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={confirmWechselSection}
                  disabled={!wechselOutId || !wechselInId}
                  className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-emerald-600 text-base font-bold text-white disabled:opacity-35 active:scale-[0.99]"
                >
                  Wechsel bestätigen
                </button>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Spielzeit</h2>
              <ul className="space-y-2">
                {sortRosterByNumber(roster.filter((p) => squadPlayerIds.includes(p.id))).map((p) => {
                  const sec = playtimes[p.id] ?? 0;
                  const st = getPlaytimeStatus(sec, currentMatchSeconds, squadPlayerIds.length);
                  const onF = onFieldIds.includes(p.id);
                  return (
                    <li
                      key={p.id}
                      className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 ${
                        onF ? 'border-emerald-500/35 bg-emerald-950/25' : 'border-white/10 bg-white/[0.04] opacity-80'
                      }`}
                    >
                      <span className={`h-3 w-3 shrink-0 rounded-full ${ampelDot(st)}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {p.number || '–'} · {p.name}
                        </p>
                        <p className="text-xs text-white/45">{onF ? 'Am Feld' : 'Bank / außerhalb'}</p>
                      </div>
                      <span className="font-mono text-lg font-bold tabular-nums text-emerald-400">
                        {formatClock(sec)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Spielverlauf</h2>
              <ul className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                {events
                  .filter((e) => e.type !== 'pause')
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 12)
                  .map((ev) => (
                    <li
                      key={ev.id}
                      className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-sm active:bg-white/5"
                    >
                      <span className="w-10 shrink-0 font-mono text-xs text-white/50">
                        {formatMinute(ev.timestamp)}
                      </span>
                      <span className="text-lg">{eventIcon(ev.type)}</span>
                      <span className="min-w-0 flex-1 font-medium leading-snug">{eventLabel(ev)}</span>
                    </li>
                  ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Am Feld (7)</h2>
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 to-black/80 p-4">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-emerald-500/80">
                  Mini-Spielfeld
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {fieldPlayers.slice(0, 7).map((p) => (
                    <div
                      key={p.id}
                      className="flex w-[30%] min-w-[92px] max-w-[120px] flex-col items-center justify-center rounded-xl border border-white/10 bg-black/40 px-1 py-3"
                    >
                      <span className="text-lg font-black text-emerald-400">{p.number || '–'}</span>
                      <span className="mt-1 max-w-full truncate text-center text-xs font-semibold text-white">
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {mainTab === 'lineup' && (
          <div className="space-y-4">
            <p className="text-sm text-white/55">Tippe einen Spieler für Wechsel.</p>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-emerald-500">Am Feld</h3>
              <ul className="space-y-2">
                {fieldPlayers.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => openSubFromPlayer(p)}
                      className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-emerald-600/40 bg-emerald-950/30 px-4 py-3 text-left active:bg-emerald-900/40"
                    >
                      <span className="text-lg font-bold text-emerald-400">{p.number || '–'}</span>
                      <span className="flex-1 px-3 text-base font-semibold">{p.name}</span>
                      <span className="rounded-full bg-emerald-600/30 px-2 py-1 text-xs font-bold text-emerald-300">
                        AM FELD
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-white/40">Bank</h3>
              <ul className="space-y-2">
                {benchPlayers.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => openSubFromPlayer(p)}
                      className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left active:bg-white/10"
                    >
                      <span className="text-lg font-bold text-white/50">{p.number || '–'}</span>
                      <span className="flex-1 px-3 text-base font-semibold">{p.name}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white/50">
                        BANK
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {mainTab === 'events' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(
                [
                  ['all', 'Alle'],
                  ['goals', 'Tore'],
                  ['subs', 'Wechsel'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEventsFilter(key)}
                  className={`min-h-[44px] flex-1 rounded-xl px-2 text-sm font-bold ${
                    eventsFilter === key ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2">
              {filteredEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="flex min-h-[52px] items-center gap-3 rounded-xl border-b border-white/5 px-3 py-2 last:border-0"
                >
                  <span className="w-10 font-mono text-xs text-white/45">{formatMinute(ev.timestamp)}</span>
                  <span className="text-lg">{eventIcon(ev.type)}</span>
                  <span className="flex-1 text-sm font-medium">{eventLabel(ev)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mainTab === 'time' && (
          <div className="space-y-2">
            <p className="mb-2 text-sm text-white/55">Effektive Spielzeit (ohne Pausen)</p>
            <ul className="space-y-2">
              {sortRosterByNumber(roster.filter((p) => squadPlayerIds.includes(p.id))).map((p) => {
                const sec = playtimes[p.id] ?? 0;
                const st = getPlaytimeStatus(sec, currentMatchSeconds, squadPlayerIds.length);
                const onF = onFieldIds.includes(p.id);
                return (
                  <li
                    key={p.id}
                    className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 ${
                      onF ? 'border-emerald-500/35 bg-emerald-950/20' : 'border-white/10 bg-white/[0.04] opacity-85'
                    }`}
                  >
                    <span className={`h-3 w-3 shrink-0 rounded-full ${ampelDot(st)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {p.number || '–'} · {p.name}
                      </p>
                      <p className="text-xs text-white/45">{onF ? 'Am Feld' : 'Bank'}</p>
                    </div>
                    <span className="font-mono text-lg font-bold tabular-nums text-emerald-400">
                      {formatClock(sec)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {subOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm"
          role="presentation"
          onClick={() => setSubOpen(false)}
        >
          <div
            className="max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#141414] px-4 pb-8 pt-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h3 className="text-center text-lg font-bold">Wechsel</h3>
            <p className="mt-1 text-center text-sm text-white/50">Raus + Rein wählen, dann bestätigen</p>

            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-red-400/90">Raus (vom Feld)</p>
                <div className="flex flex-wrap gap-2">
                  {fieldPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSubOutId(p.id)}
                      className={`min-h-[48px] min-w-[100px] flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                        subOutId === p.id ? 'bg-red-600 text-white' : 'bg-white/10 text-white active:bg-white/20'
                      }`}
                    >
                      {p.number || '–'} {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-emerald-400/90">Rein (von der Bank)</p>
                <div className="flex flex-wrap gap-2">
                  {benchPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSubInId(p.id)}
                      className={`min-h-[48px] min-w-[100px] flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                        subInId === p.id ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white active:bg-white/20'
                      }`}
                    >
                      {p.number || '–'} {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={!subOutId || !subInId}
              onClick={confirmSub}
              className="mt-6 flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white disabled:opacity-35 active:scale-[0.99]"
            >
              ✔ Wechsel bestätigen
            </button>
            <button
              type="button"
              onClick={() => setSubOpen(false)}
              className="mt-3 w-full min-h-[48px] rounded-2xl border border-white/15 text-base font-semibold text-white/80"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMatchScreen;
