import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSession } from '../auth/useSession';
import { Button } from '../app/components/ui/Button';

type CalendarEvent = {
  id: string;
  team_season_id: string;
  event_type: 'game' | 'training' | 'event' | 'other';
  starts_at: string;
  location: string | null;
  title: string;
  team_name: string | null;
};

type DayEvents = CalendarEvent[];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getMonthGrid(date: Date): Date[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const startWeekday = (start.getDay() + 6) % 7; // Montag=0
  const days: Date[] = [];
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() - (startWeekday - i));
    days.push(d);
  }
  for (let d = 1; d <= end.getDate(); d++) {
    days.push(new Date(date.getFullYear(), date.getMonth(), d));
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1];
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    days.push(d);
  }
  return days;
}

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { effectiveRole, teamSeasons, loading } = useSession();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedTeamSeasonId, setSelectedTeamSeasonId] = useState<string | 'all'>('all');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFan = effectiveRole === 'fan';
  const canSeeAllTeams =
    effectiveRole === 'trainer' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'head_coach' ||
    effectiveRole === 'co_trainer';

  useEffect(() => {
    if (isFan && !loading) {
      navigate('/app/schedule', { replace: true });
    }
  }, [isFan, loading, navigate]);

  const accessibleTeamSeasons = useMemo(() => {
    if (!teamSeasons) return [];
    if (canSeeAllTeams) return teamSeasons;
    return teamSeasons;
  }, [teamSeasons, canSeeAllTeams]);

  useEffect(() => {
    if (accessibleTeamSeasons.length === 0) return;
    if (selectedTeamSeasonId !== 'all') return;
    setSelectedTeamSeasonId('all');
  }, [accessibleTeamSeasons, selectedTeamSeasonId]);

  useEffect(() => {
    const loadEvents = async () => {
      if (accessibleTeamSeasons.length === 0) {
        setEvents([]);
        return;
      }
      setLoadingEvents(true);
      setError(null);
      try {
        const start = new Date(currentMonth);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = endOfMonth(currentMonth);
        end.setHours(23, 59, 59, 999);

        const teamSeasonIds =
          selectedTeamSeasonId === 'all'
            ? accessibleTeamSeasons.map((ts) => ts.id)
            : [selectedTeamSeasonId];

        // Erster Versuch: mit event_type-Spalte laden
        let data: any[] | null = null;
        let loadError: string | null = null;
        const first = await supabase
          .from('events')
          .select('id, team_season_id, event_type, kind, opponent, notes, location, starts_at')
          .in('team_season_id', teamSeasonIds)
          .gte('starts_at', start.toISOString())
          .lte('starts_at', end.toISOString())
          .order('starts_at', { ascending: true });

        if (first.error && first.error.message?.includes('event_type')) {
          // Fallback: ohne event_type-Spalte (alte DB)
          const second = await supabase
            .from('events')
            .select('id, team_season_id, kind, opponent, notes, location, starts_at')
            .in('team_season_id', teamSeasonIds)
            .gte('starts_at', start.toISOString())
            .lte('starts_at', end.toISOString())
            .order('starts_at', { ascending: true });
          if (second.error) {
            loadError = second.error.message;
          } else {
            data = second.data ?? [];
          }
        } else if (first.error) {
          loadError = first.error.message;
        } else {
          data = first.data ?? [];
        }

        if (loadError) {
          setError(loadError);
          setEvents([]);
        } else {
          const mapped: CalendarEvent[] = (data ?? []).map((r: any) => {
            const rawType = (r.event_type ?? '').trim().toLowerCase();
            const kind = (r.kind ?? '').trim().toLowerCase();
            let t: CalendarEvent['event_type'];
            if (rawType === 'game' || rawType === 'training' || rawType === 'event' || rawType === 'other') {
              t = rawType;
            } else if (kind === 'match') {
              t = 'game';
            } else if (kind === 'training') {
              t = 'training';
            } else if (kind === 'event') {
              t = 'event';
            } else {
              t = 'other';
            }

            const startsAt = r.starts_at as string;
            let title = '';
            if (t === 'game') {
              title = r.opponent || 'Spiel';
            } else if (t === 'training') {
              title = 'Training';
            } else {
              title = (r.notes as string | null)?.split(' · ')[0] || 'Termin';
            }

            const ts = accessibleTeamSeasons.find((ts: any) => ts.id === r.team_season_id);
            const teamName = ts?.teams?.name ?? null;

            return {
              id: r.id,
              team_season_id: r.team_season_id,
              event_type: t,
              starts_at: startsAt,
              location: r.location ?? null,
              title,
              team_name: teamName,
            };
          });
          setEvents(mapped);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Unbekannter Fehler');
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };
    if (!isFan) {
      loadEvents();
    }
  }, [currentMonth, accessibleTeamSeasons, selectedTeamSeasonId, isFan]);

  const days = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvents>();
    for (const ev of events) {
      const d = new Date(ev.starts_at);
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const monthLabel = currentMonth.toLocaleDateString('de-AT', {
    month: 'long',
    year: 'numeric',
  });

  const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const getEventColorClass = (type: CalendarEvent['event_type']) => {
    if (type === 'game') return 'bg-red-600/80 text-white';
    if (type === 'training') return 'bg-blue-600/80 text-white';
    if (type === 'event') return 'bg-white/15 text-white';
    return 'bg-white/10 text-white/80';
  };

  return (
    <div className="page relative min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Kalender</h1>
            <p className="mt-1 text-sm text-white/70">
              Termine für Spiele, Trainings und Events.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setCurrentMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                )
              }
            >
              ←
            </Button>
            <span className="text-sm text-white/80 min-w-[120px] text-center">{monthLabel}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setCurrentMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                )
              }
            >
              →
            </Button>
          </div>
        </div>

        {!loading && !isFan && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="calendar-team-filter"
                className="text-xs font-medium text-white/70"
              >
                Mannschaft:
              </label>
              <select
                id="calendar-team-filter"
                value={selectedTeamSeasonId}
                onChange={(e) => setSelectedTeamSeasonId(e.target.value as any)}
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white"
              >
                {canSeeAllTeams && (
                  <option value="all">Alle Teams</option>
                )}
                {accessibleTeamSeasons.map((ts: any) => (
                  <option key={ts.id} value={ts.id}>
                    {ts.teams?.name ?? 'Team'} {ts.seasons?.name ? `(${ts.seasons.name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {loadingEvents && (
              <p className="text-xs text-white/60">Lade Termine…</p>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="grid grid-cols-7 gap-2 text-xs text-white/60 mb-2">
            {weekdayLabels.map((w) => (
              <div key={w} className="text-center font-medium">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 text-xs">
            {days.map((day) => {
              const key = day.toISOString().slice(0, 10);
              const dayEvents = eventsByDay.get(key) ?? [];
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              return (
                <div
                  key={key}
                  className={`min-h-[72px] rounded-xl border px-1.5 py-1.5 ${
                    isCurrentMonth
                      ? 'border-white/15 bg-white/5'
                      : 'border-white/5 bg-black/20 opacity-70'
                  }`}
                >
                  <div className="mb-1 text-right text-[11px] font-semibold text-white/80">
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.map((ev) => {
                      const t = new Date(ev.starts_at);
                      const time = t.toLocaleTimeString('de-AT', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <div
                          key={ev.id}
                          className={`flex flex-col rounded-md px-1 py-0.5 ${getEventColorClass(
                            ev.event_type,
                          )}`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold tabular-nums">
                              {time}
                            </span>
                            <span className="truncate text-[10px] font-semibold">
                              {ev.title}
                            </span>
                          </div>
                          {ev.team_name && (
                            <span className="text-[9px] text-white/80 truncate">
                              {ev.team_name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

