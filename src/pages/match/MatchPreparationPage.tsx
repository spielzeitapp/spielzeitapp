import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayers } from '../../hooks/usePlayers';
import { comparePlayerItems } from '../../lib/rosterPlayer';
import { saveMatchSquadOnly } from '../../lib/liveMatchService';
import { MinimumPlaytimeMatchSettings } from '../../components/live/MinimumPlaytimeMatchSettings';
import {
  DEFAULT_MINIMUM_PLAYTIME_MINUTES,
  DEFAULT_PLANNED_MATCH_MINUTES,
} from '../../lib/minimumPlaytime';
import { supabase } from '../../lib/supabaseClient';
import { MatchPlayerRow } from '../../components/match/MatchPlayerRow';
import { premiumPlayerDisplayName } from '../../lib/premiumPlayerCard';
import {
  dsBrandKickerClass,
  dsPageAtmosphereClass,
  dsPageContentClass,
  dsPageHeaderClass,
  dsPageHeroGlowClass,
  dsPageShellClass,
  dsPageSubtitleClass,
  dsPageTitleClass,
  dsPrimaryCtaClass,
  dsSectionLabelClass,
  dsStatusChipClass,
  dsStickyCtaBarClass,
  DS_LIST_GAP,
  DS_SECTION_GAP,
  type DsChipTone,
} from '../../lib/premiumDesignSystem';

type MatchRowLite = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  minimum_playtime_enabled: boolean | null;
  minimum_playtime_minutes: number | null;
  planned_match_minutes: number | null;
};

type PrepStatus = 'available' | 'open' | 'absent';

function normalizeAttendanceStatus(value: unknown): 'yes' | 'no' | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'yes' || raw === 'dabei' || raw === 'attending' || raw === 'confirmed' || raw === 'present') return 'yes';
  if (raw === 'no' || raw === 'abwesend' || raw === 'absent' || raw === 'declined') return 'no';
  return null;
}

function playerStatusFromAttendance(value: 'yes' | 'no' | null): PrepStatus {
  if (value === 'yes') return 'available';
  if (value === 'no') return 'absent';
  return 'open';
}

export const MatchPreparationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('matchId')?.trim() || null;
  const [matchRow, setMatchRow] = useState<MatchRowLite | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [restoredSelectedPlayers, setRestoredSelectedPlayers] = useState<string[]>([]);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [attendanceByPlayerId, setAttendanceByPlayerId] = useState<Record<string, 'yes' | 'no'>>({});

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
      const [{ data, error }, lineupRes, benchRes] = await Promise.all([
        supabase
          .from('matches')
          .select('id, team_season_id, opponent, minimum_playtime_enabled, minimum_playtime_minutes, planned_match_minutes')
          .eq('id', matchId)
          .maybeSingle(),
        supabase.from('match_lineup').select('player_id').eq('match_id', matchId),
        supabase.from('match_bench').select('player_id').eq('match_id', matchId),
      ]);
      if (cancelled) return;
      if (error || !data) {
        setMatchRow(null);
        setMatchError(error?.message ?? 'Spiel nicht gefunden.');
      } else {
        setMatchRow(data as MatchRowLite);
        const restored = new Set<string>();
        for (const row of (lineupRes.data ?? []) as Array<{ player_id: string | null }>) {
          if (row.player_id) restored.add(row.player_id);
        }
        for (const row of (benchRes.data ?? []) as Array<{ player_id: string | null }>) {
          if (row.player_id) restored.add(row.player_id);
        }
        const restoredList = [...restored];
        setRestoredSelectedPlayers(restoredList);
        setSelectedPlayers(restoredList);
      }
      setMatchLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const teamSeasonId = matchRow?.team_season_id ?? null;
  const { players, loading: playersLoading, error: playersError } = usePlayers(teamSeasonId);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setAttendanceByPlayerId({});
      setAttendanceLoading(false);
      setAttendanceError(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      setAttendanceLoading(true);
      setAttendanceError(null);
      const { data: events, error: eventsErr } = await supabase
        .from('events')
        .select('id, starts_at')
        .eq('match_id', matchId)
        .order('starts_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (eventsErr) {
        setAttendanceByPlayerId({});
        setAttendanceError(eventsErr.message);
        setAttendanceLoading(false);
        return;
      }
      const eventId = events?.[0]?.id ?? null;
      if (!eventId) {
        setAttendanceByPlayerId({});
        setAttendanceLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('event_attendance')
        .select('player_id, status')
        .eq('event_id', eventId);
      if (cancelled) return;
      if (error) {
        setAttendanceByPlayerId({});
        setAttendanceError(error.message);
      } else {
        const byPlayer: Record<string, 'yes' | 'no'> = {};
        for (const row of (data ?? []) as Array<{ player_id: string | null; status: unknown }>) {
          const pid = String(row.player_id ?? '').toLowerCase();
          if (!pid) continue;
          const status = normalizeAttendanceStatus(row.status);
          if (status) byPlayer[pid] = status;
        }
        setAttendanceByPlayerId(byPlayer);
      }
      setAttendanceLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const getAttendance = (playerId: string): 'yes' | 'no' | null => attendanceByPlayerId[playerId.toLowerCase()] ?? null;

  const grouped = useMemo(() => {
    const sorted = [...players].sort(comparePlayerItems);
    const available: typeof sorted = [];
    const open: typeof sorted = [];
    const absent: typeof sorted = [];
    for (const p of sorted) {
      const st = playerStatusFromAttendance(getAttendance(p.id));
      if (st === 'available') available.push(p);
      else if (st === 'open') open.push(p);
      else absent.push(p);
    }
    return { available, open, absent };
  }, [players, attendanceByPlayerId]);

  const summary = useMemo(
    () => ({
      yes: grouped.available.length,
      open: grouped.open.length,
      no: grouped.absent.length,
      selected: selectedPlayers.filter((id) => grouped.available.some((p) => p.id === id)).length,
    }),
    [grouped.available, grouped.open.length, grouped.absent.length, selectedPlayers],
  );

  useEffect(() => {
    if (selectionInitialized) return;
    if (playersLoading || attendanceLoading) return;
    if (players.length === 0) return;
    const initial = new Set<string>();
    for (const restoredId of restoredSelectedPlayers) {
      if (getAttendance(restoredId) === 'yes') initial.add(restoredId);
    }
    for (const p of players) {
      if (getAttendance(p.id) === 'yes') initial.add(p.id);
    }
    setSelectedPlayers([...initial]);
    setSelectionInitialized(true);
  }, [
    selectionInitialized,
    playersLoading,
    attendanceLoading,
    players,
    restoredSelectedPlayers,
    attendanceByPlayerId,
  ]);

  const togglePlayer = (playerId: string, status: PrepStatus) => {
    if (status !== 'available') return;
    setSelectionInitialized(true);
    setSelectedPlayers((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      return [...prev, playerId];
    });
  };

  const selectablePlayerIds = useMemo(() => new Set(grouped.available.map((p) => p.id)), [grouped.available]);
  const selectedPlayersAvailableOnly = useMemo(
    () => selectedPlayers.filter((id) => selectablePlayerIds.has(id)),
    [selectedPlayers, selectablePlayerIds],
  );
  const selectedSet = useMemo(() => new Set(selectedPlayersAvailableOnly), [selectedPlayersAvailableOnly]);

  const renderSection = (title: string, list: typeof players, status: PrepStatus) => (
    <section className={`flex flex-col ${DS_SECTION_GAP}`}>
      <h2 className={dsSectionLabelClass()}>{title}</h2>
      {list.length === 0 ? <p className="text-xs text-white/42">Keine Spieler</p> : null}
      <div className={`flex flex-col ${DS_LIST_GAP}`}>
        {list.map((p) => {
          const selected = selectedSet.has(p.id);
          const disabled = status !== 'available';
          return (
            <div key={p.id} className={disabled ? "opacity-70" : ""}>
              <MatchPlayerRow
                player={p}
                selected={selected}
                status={status === "available" ? "yes" : status === "absent" ? "no" : "open"}
                rightLabel={
                  status === "absent"
                    ? "Abwesend"
                    : status === "open"
                      ? "Offen"
                      : selected
                        ? "✓ Im Kader"
                        : "Auswählen"
                }
                onClick={disabled ? undefined : () => togglePlayer(p.id, status)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );

  if (matchLoading) {
    return <div className="min-h-[100dvh] p-4 text-sm text-white/60">Lade Match…</div>;
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

  const onContinueToLineup = async () => {
    if (!matchId || selectedPlayersAvailableOnly.length === 0 || persisting) return;
    setPersistError(null);
    setPersisting(true);
    const { error } = await saveMatchSquadOnly(matchId, selectedPlayersAvailableOnly);
    setPersisting(false);
    if (error) {
      setPersistError(error);
      return;
    }
    navigate(`/app/match-lineup?matchId=${encodeURIComponent(matchId)}`, {
      state: { selectedPlayers: selectedPlayersAvailableOnly },
    });
  };

  return (
    <div className={dsPageShellClass()}>
      <div className={dsPageAtmosphereClass()} aria-hidden />
      <header className={`${dsPageHeaderClass()} relative overflow-hidden`}>
        <div className={dsPageHeroGlowClass()} aria-hidden />
        <div className="relative mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-2 inline-flex min-h-[36px] items-center rounded-[14px] border border-transparent bg-[rgba(18,18,22,0.88)] px-2.5 text-xs font-semibold text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_14px_rgba(255,40,40,0.05)] hover:bg-[rgba(22,14,16,0.92)]"
            >
              ← Zurück
            </button>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400/90">SpielzeitApp</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight">Match-Vorbereitung</h1>
            <p className="mt-1 text-sm text-white/55">{matchRow?.opponent ? `vs. ${matchRow.opponent}` : 'Spiel'}</p>
          </div>
          <span className={dsStatusChipClass('selected')}>Trainer</span>
        </div>
      </header>

      <main className={dsPageContentClass(`mx-auto max-w-xl flex flex-col ${DS_SECTION_GAP} px-4 py-5 pb-48`)}>
        {(playersLoading || attendanceLoading) ? <p className="text-sm text-white/55">Lade Spieler und Status…</p> : null}
        {(playersError || attendanceError) ? <p className="text-sm text-red-400">{playersError ?? attendanceError}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['present', `Zugesagt ${summary.yes}`],
              ['open', `Offen ${summary.open}`],
              ['absent', `Abgesagt ${summary.no}`],
              ['neutral', `Ausgewählt ${summary.selected}`],
            ] as const
          ).map(([tone, label]) => (
            <span key={tone} className={dsStatusChipClass(tone as DsChipTone)}>
              {label}
            </span>
          ))}
        </div>

        {renderSection('Verfügbar', grouped.available, 'available')}
        {renderSection('Offen', grouped.open, 'open')}
        {renderSection('Abgesagt', grouped.absent, 'absent')}

        {matchId && matchRow ? (
          <MinimumPlaytimeMatchSettings
            matchId={matchId}
            plannedMinutes={matchRow.planned_match_minutes ?? DEFAULT_PLANNED_MATCH_MINUTES}
            enabled={Boolean(matchRow.minimum_playtime_enabled)}
            minutes={matchRow.minimum_playtime_minutes ?? DEFAULT_MINIMUM_PLAYTIME_MINUTES}
            onSaved={(patch) =>
              setMatchRow((prev) =>
                prev
                  ? {
                      ...prev,
                      planned_match_minutes: patch.plannedMinutes,
                      minimum_playtime_enabled: patch.enabled,
                      minimum_playtime_minutes: patch.minutes,
                    }
                  : prev,
              )
            }
          />
        ) : null}

        <section className={`flex flex-col ${DS_SECTION_GAP}`}>
          <h2 className={dsSectionLabelClass()}>Matchkader: {selectedPlayersAvailableOnly.length} Spieler</h2>
          {selectedPlayersAvailableOnly.length === 0 ? (
            <p className="text-xs text-white/45">Noch keine Spieler ausgewählt.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedPlayersAvailableOnly.map((id) => {
                const p = players.find((x) => x.id === id);
                return (
                  <span
                    key={id}
                    className="rounded-full border border-red-500/35 bg-red-950/35 px-2.5 py-0.5 text-[11px] font-semibold text-red-200"
                  >
                    {premiumPlayerDisplayName(p ?? { display_name: id })}
                  </span>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <div
        className={dsStickyCtaBarClass()}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <span className="text-[11px] font-medium text-white/45">
            Ausgewählt: {selectedPlayersAvailableOnly.length}
          </span>
          <button
            type="button"
            disabled={selectedPlayersAvailableOnly.length === 0 || persisting}
            onClick={() => void onContinueToLineup()}
            className={dsPrimaryCtaClass()}
          >
            {persisting ? 'Speichern…' : 'Weiter zur Aufstellung'}
          </button>
        </div>
        {persistError ? <p className="mx-auto mt-1 max-w-xl text-xs text-red-400">{persistError}</p> : null}
      </div>
    </div>
  );
};
