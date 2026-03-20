import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSession } from '../auth/useSession';
import { Button } from '../app/components/ui/Button';
import { Modal } from '../app/ui/Modal';
import { buildTeamIcsFeedUrl } from '../lib/calendarFeed';
import type { CalendarEvent, CalendarView } from './calendar/calendarTypes';
import { resolveEndAtFromNotes, toLocalDayKey, addDays, startOfWeekMonday } from './calendar/calendarUtils';
import { CalendarListView } from './calendar/CalendarListView';
import { CalendarWeekView } from './calendar/CalendarWeekView';
import { CalendarMonthView } from './calendar/CalendarMonthView';

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
  const { effectiveRole, teamSeasons, loading, selectedMembership } = useSession();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedTeamSeasonId, setSelectedTeamSeasonId] = useState<string | 'all'>('all');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);

  const [view, setView] = useState<CalendarView>(() => {
    try {
      const saved = window.localStorage.getItem('sz_calendar_view_v1');
      if (saved === 'list' || saved === 'week' || saved === 'month') return saved;
    } catch {
      // ignore
    }
    return 'list';
  });
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());

  useEffect(() => {
    try {
      window.localStorage.setItem('sz_calendar_view_v1', view);
    } catch {
      // ignore
    }
  }, [view]);

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
    if (canSeeAllTeams) {
      setSelectedTeamSeasonId('all');
      return;
    }
    setSelectedTeamSeasonId(accessibleTeamSeasons[0]?.id ?? 'all');
  }, [accessibleTeamSeasons, selectedTeamSeasonId, canSeeAllTeams]);

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
            const notes: string | null = (r.notes as string | null) ?? null;
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
              end_at: resolveEndAtFromNotes({
                startsAtIso: startsAt,
                eventType: t,
                notes,
              }),
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
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.starts_at);
      const key = toLocalDayKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const monthLabel = currentMonth.toLocaleDateString('de-AT', {
    month: 'long',
    year: 'numeric',
  });

  const todayKey = toLocalDayKey(new Date());
  const weekStart = startOfWeekMonday(weekAnchor);
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${weekStart.toLocaleDateString('de-AT', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })} – ${weekEnd.toLocaleDateString('de-AT', { day: 'numeric', month: 'long' })}`;
  const headerLabel = view === 'week' ? weekLabel : monthLabel;

  const getEventColorClass = (type: CalendarEvent['event_type']) => {
    if (type === 'game') return 'bg-red-600/80 text-white';
    if (type === 'training') return 'bg-green-600/80 text-white';
    if (type === 'event') return 'bg-white/10 text-white/90';
    return 'bg-white/10 text-white/80';
  };

  const selectedTeamIdForFeed = useMemo(() => {
    // 1) Team aus aktuellem Kalender-Filter (Trainer/Fachrollen wechseln hier aktiv)
    if (selectedTeamSeasonId !== 'all') {
      const selected = accessibleTeamSeasons.find((ts: any) => ts.id === selectedTeamSeasonId);
      const teamObj = selected?.team ?? (Array.isArray(selected?.teams) ? selected.teams[0] : selected?.teams);
      if (teamObj?.id) return teamObj.id as string;
    }

    // 2) Team aus aktiver Membership (Parent/Player i.d.R. genau 1 Team)
    const fromMembership =
      selectedMembership?.team_seasons?.team ??
      (Array.isArray(selectedMembership?.team_seasons?.teams)
        ? selectedMembership?.team_seasons?.teams[0]
        : selectedMembership?.team_seasons?.teams);
    if ((fromMembership as any)?.id) return (fromMembership as any).id as string;

    // 3) Fallback bei genau einem zugreifbaren Team
    if (accessibleTeamSeasons.length === 1) {
      const only = accessibleTeamSeasons[0] as any;
      const teamObj = only?.team ?? (Array.isArray(only?.teams) ? only.teams[0] : only?.teams);
      return teamObj?.id ?? null;
    }

    return null;
  }, [selectedTeamSeasonId, accessibleTeamSeasons, selectedMembership]);

  const feedUrl = useMemo(() => {
    if (!selectedTeamIdForFeed) return null;
    return buildTeamIcsFeedUrl(window.location.origin, selectedTeamIdForFeed);
  }, [selectedTeamIdForFeed]);

  const handleSubscribeCalendar = async () => {
    if (!feedUrl) return;
    setSubscribeModalOpen(true);
  };

  const handleCopyFeedUrl = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      alert('Feed-URL kopiert.');
    } catch {
      window.open(feedUrl, '_blank', 'noopener,noreferrer');
    }
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
              onClick={() => {
                if (view === 'week') {
                  const next = new Date(weekAnchor);
                  next.setDate(next.getDate() - 7);
                  setWeekAnchor(next);
                  setCurrentMonth(new Date(next.getFullYear(), next.getMonth(), 1));
                } else {
                  setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                }
              }}
            >
              ←
            </Button>
            <span className="text-sm text-white/80 min-w-[160px] text-center">{headerLabel}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (view === 'week') {
                  const next = new Date(weekAnchor);
                  next.setDate(next.getDate() + 7);
                  setWeekAnchor(next);
                  setCurrentMonth(new Date(next.getFullYear(), next.getMonth(), 1));
                } else {
                  setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                }
              }}
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
            <div className="flex items-center gap-2">
              {feedUrl && (
                <Button
                  variant="soft"
                  size="sm"
                  className="rounded-xl"
                  onClick={handleSubscribeCalendar}
                >
                  Kalender abonnieren
                </Button>
              )}
              {loadingEvents && (
                <p className="text-xs text-white/60">Lade Termine…</p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="inline-flex items-center rounded-xl border border-white/10 bg-black/20 p-1">
              {([
                ['list', 'Liste'],
                ['week', 'Woche'],
                ['month', 'Monat'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    view === key
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'text-white/70 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="text-xs text-white/60">
              {view === 'week' ? '7-Tage-Ansicht' : view === 'month' ? 'Monatsansicht' : 'Agenda'}
            </div>
          </div>

          {view === 'list' ? (
            <CalendarListView events={events} getEventColorClass={getEventColorClass} todayKey={todayKey} />
          ) : view === 'week' ? (
            <CalendarWeekView
              weekAnchor={weekAnchor}
              events={events}
              getEventColorClass={getEventColorClass}
              todayKey={todayKey}
            />
          ) : (
            <CalendarMonthView
              days={days}
              currentMonth={currentMonth}
              eventsByDay={eventsByDay}
              getEventColorClass={getEventColorClass}
              todayKey={todayKey}
            />
          )}
        </div>

        <Modal
          isOpen={subscribeModalOpen}
          title="Kalender abonnieren"
          onClose={() => setSubscribeModalOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSubscribeModalOpen(false)}>
                Schließen
              </Button>
              <Button variant="primary" onClick={handleCopyFeedUrl}>
                Link kopieren
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-white/80">
              Diese URL in Apple Kalender, Google Kalender, Outlook oder FamilyWall als Abo-Link einfügen:
            </p>
            <div className="rounded-lg border border-white/15 bg-black/40 p-3 text-xs text-white/90 break-all">
              {feedUrl ?? 'Kein Team ausgewählt'}
            </div>
            <p className="text-xs text-white/60">
              Tipp: Apple/Google/FamilyWall haben oft eine verzögerte Aktualisierung (kein Echtzeit-Update).
            </p>
          </div>
        </Modal>
      </div>
    </div>
  );
};

