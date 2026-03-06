import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Tabs, TabOption } from '../app/components/ui/Tabs';
import { Button } from '../app/components/ui/Button';
import { useSession } from '../auth/useSession';
import { useMatchEngine } from '../match/useMatchEngine';
import type { MatchEvent } from '../match/events';
import { supabase } from '../lib/supabaseClient';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePlayers } from '../hooks/usePlayers';
import { useMatchRsvps } from '../hooks/useMatchRsvps';
import { useAvailabilityPermissions } from '../hooks/useAvailabilityPermissions';

type MatchInfo = {
  id: string;
  team_season_id: string | null;
  match_date: string | null;
  opponent: string | null;
  status: string | null;
};

type MatchTabId = 'info' | 'rsvp' | 'squad' | 'lineup' | 'live';

const allTabs: TabOption[] = [
  { id: 'info', label: 'Info' },
  { id: 'rsvp', label: 'Zu-/Absagen' },
  { id: 'squad', label: 'Kader' },
  { id: 'lineup', label: 'Aufstellung' },
  { id: 'live', label: 'Live' },
];

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function describeEvent(event: MatchEvent): string {
  switch (event.type) {
    case 'MATCH_STARTED':
      return 'Spiel gestartet';
    case 'MATCH_PAUSED':
      return 'Pause';
    case 'PERIOD_STARTED':
      return `Periode ${event.period} gestartet`;
    case 'PERIOD_ENDED':
      return 'Periode beendet';
    case 'GOAL':
      return event.team === 'home' ? 'Tor Heim' : 'Tor Gast';
    case 'SUBSTITUTION':
      return 'Wechsel';
    case 'CARD':
      return event.card === 'red' ? 'Rote Karte' : 'Gelbe Karte';
    case 'NOTE':
      return event.text;
    case 'MATCH_ENDED':
      return 'Spiel beendet';
    default:
      return event.type;
  }
}

export const MatchDetailsPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const id = matchId ?? null;
  const navigate = useNavigate();
  const { role, canAccess } = useSession();
  const { teamSeasonId, role: activeRole } = useActiveTeamSeason();
  const { players, loading: playersLoading, error: playersError } = usePlayers(teamSeasonId);
  const { rsvpByPlayerId, setRsvp, loading: rsvpLoading, error: rsvpError, saving: rsvpSaving } = useMatchRsvps(id);
  const perms = useAvailabilityPermissions({ role: activeRole, teamSeasonId });

  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setMatch(null);
      setMatchLoading(false);
      setMatchError(null);
      return;
    }
    let alive = true;
    setMatchLoading(true);
    setMatchError(null);
    supabase
      .from('matches')
      .select('id, team_season_id, opponent, match_date, status')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) {
          console.error('[MatchDetailsPage] match load:', err.message);
          setMatchError(err.message);
          setMatch(null);
        } else if (data) {
          const row = data as { id: string; team_season_id: string; opponent: string | null; match_date: string | null; status: string | null };
          setMatch({
            id: row.id,
            team_season_id: row.team_season_id,
            match_date: row.match_date,
            opponent: row.opponent,
            status: row.status,
          });
        } else {
          setMatch(null);
        }
        setMatchLoading(false);
      });
    return () => { alive = false; };
  }, [id]);

  const visibleTabs = React.useMemo(() => {
    if (activeRole === 'fan') return allTabs.filter((t) => t.id === 'info');
    if (activeRole === 'parent' || activeRole === 'player') {
      return allTabs.filter((t) => t.id === 'info' || t.id === 'rsvp');
    }
    // trainer / admin: alle Tabs (inkl. Live)
    return allTabs;
  }, [activeRole]);

  const isTrainerOrAdmin = activeRole === 'trainer' || activeRole === 'admin';

  const [activeTab, setActiveTab] = useState<MatchTabId>((visibleTabs[0]?.id as MatchTabId) ?? 'info');

  const { state, log, dispatchEvent } = useMatchEngine(matchId ?? '');
  const elapsedMs = state ? state.clock.elapsedMs + (state.clock.isRunning && state.clock.startedAt ? Date.now() - state.clock.startedAt : 0) : 0;
  const latestEvents = log.slice(-10).reverse();
  const isAdmin = canAccess('match_admin');

  if (matchLoading) {
    return (
      <div className="space-y-3 pb-4">
        <button
          type="button"
          onClick={() => navigate('/schedule')}
          className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
        >
          ← Spielplan
        </button>
        <p className="text-sm text-[var(--muted)]">Lade Spiel…</p>
      </div>
    );
  }
  if (matchError) {
    return (
      <div className="space-y-3 pb-4">
        <button
          type="button"
          onClick={() => navigate('/schedule')}
          className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
        >
          ← Spielplan
        </button>
        <p className="text-sm text-red-600" role="alert">{matchError}</p>
      </div>
    );
  }
  if (!match) {
    return (
      <div className="space-y-3 pb-4">
        <button
          type="button"
          onClick={() => navigate('/schedule')}
          className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
        >
          ← Spielplan
        </button>
        <p className="text-sm text-[var(--muted)]">Spiel nicht gefunden.</p>
      </div>
    );
  }

  const kickoff = match.match_date ? new Date(match.match_date) : null;
  const dateStr = kickoff ? kickoff.toLocaleDateString('de-AT') : '–';
  const timeStr = kickoff ? kickoff.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) : '–';

  const handleToggleStartPause = () => {
    if (!state) return;
    if (state.clock.isRunning) {
      dispatchEvent({ type: 'MATCH_PAUSED' });
    } else {
      dispatchEvent({ type: 'MATCH_STARTED' });
    }
  };

  const handleGoal = (team: 'home' | 'away') => {
    dispatchEvent({ type: 'GOAL', team });
  };

  return (
    <div className="space-y-3 pb-4">
      <button
        type="button"
        onClick={() => navigate('/schedule')}
        className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
      >
        ← Spielplan
      </button>

      <Card>
        <CardTitle>Spiel</CardTitle>
        <p className="mt-1 text-lg font-semibold text-[var(--text-main)]">vs. {match.opponent ?? 'Gegner'}</p>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{dateStr} • {timeStr}</p>
        {match.status && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">Status: {match.status}</p>
        )}
      </Card>

      {/* Zu-/Absage – ganz oben für Eltern/Spieler */}
      <Card>
        <CardTitle>Zu-/Absage</CardTitle>

        {(playersLoading || rsvpLoading) && <p className="mt-2 text-sm text-[var(--muted)]">Lade…</p>}
        {(playersError || rsvpError) && (
          <p className="mt-2 text-sm text-red-600" role="alert">{playersError ?? rsvpError}</p>
        )}
        {perms.error && <p className="mt-2 text-sm text-red-600" role="alert">{perms.error}</p>}
        {rsvpSaving && <p className="mt-2 text-xs text-[var(--muted)]">Speichern…</p>}

        {!playersLoading && !rsvpLoading && !playersError && !rsvpError && players.length === 0 && (
          <p className="mt-2 text-sm text-[var(--muted)]">Noch kein Kader gefunden.</p>
        )}

        {!playersLoading && !rsvpLoading && !playersError && !rsvpError && players.length > 0 && (
          <>
            <div className="mt-2 divide-y divide-[var(--border)]">
              {players.map((player) => {
                const status = rsvpByPlayerId[player.id];
                const canEdit = perms.canEdit(player.id);
                return (
                  <div key={player.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0 flex-1 text-sm text-[var(--text-main)]">
                      <span className="mr-2 text-[var(--muted)]">
                        {status === "yes" ? "Zusage" : status === "no" ? "Absage" : status === "maybe" ? "Unsicher" : "–"}
                      </span>
                      {player.display_name || "Spieler"}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        disabled={!canEdit || rsvpSaving}
                        variant={status === "yes" ? "primary" : "secondary"}
                        onClick={() => setRsvp(player.id, "yes")}
                      >
                        Zusage
                      </Button>
                      <Button
                        disabled={!canEdit || rsvpSaving}
                        variant={status === "no" ? "primary" : "secondary"}
                        onClick={() => setRsvp(player.id, "no")}
                      >
                        Absage
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-sm text-[var(--muted)]">
              Zusagen: {players.filter((p) => rsvpByPlayerId[p.id] === "yes").length}
              {" | "}
              Absagen: {players.filter((p) => rsvpByPlayerId[p.id] === "no").length}
            </div>
          </>
        )}
      </Card>

      {isTrainerOrAdmin && id && (
        <div className="flex justify-end">
          <Link to={`/match/${id}`}>
            <Button size="sm" variant="soft">Live / Aufstellung öffnen</Button>
          </Link>
        </div>
      )}

      <div className="sticky top-0 z-10 -mx-4 bg-gradient-to-b from-slate-900 to-slate-900/80 pb-1">
        <div className="px-4">
          <Tabs tabs={visibleTabs} activeId={activeTab} onChange={(id) => setActiveTab(id as MatchTabId)} />
        </div>
      </div>

      <section className="space-y-3">
        {activeTab === 'info' && (
          <Card>
            <CardTitle>Allgemeine Infos</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Hier werden später Details zum Treffpunkt, genaue Zeiten und Hinweise des Trainers angezeigt.
            </p>
          </Card>
        )}

        {activeTab === 'rsvp' && (
          <p className="text-sm text-[var(--muted)]">
            Die Zu-/Absage-Liste steht oben auf dieser Seite.
          </p>
        )}

        {activeTab === 'squad' && (
          <Card>
            <CardTitle>Kader</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Platzhalter für Kader-Verwaltung. Trainer können später hier den Spielkader definieren.
            </p>
          </Card>
        )}

        {activeTab === 'lineup' && (
          <Card>
            <CardTitle>Aufstellung</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Platzhalter für die Aufstellung. Hier erscheinen Formation, Startelf und Auswechselspieler.
            </p>
          </Card>
        )}

        {activeTab === 'live' && (
          <>
            <Card>
              <CardTitle>Live</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Spielstand: {state?.scoreHome ?? 0} : {state?.scoreAway ?? 0} • Periode {state?.period ?? 1}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">Zeit: {formatTime(elapsedMs)}</p>
            </Card>

            {isAdmin && (
              <Card>
                <CardTitle>Match Engine (Admin)</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Steuerung direkt aus den Spieldetails (gleiches Match wie auf der Live-Seite).
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={handleToggleStartPause}>
                    {state?.clock.isRunning ? 'Pause' : 'Start'}
                  </Button>
                  <Button variant="primary" onClick={() => handleGoal('home')}>
                    Tor Heim
                  </Button>
                  <Button variant="primary" onClick={() => handleGoal('away')}>
                    Tor Gast
                  </Button>
                </div>
              </Card>
            )}

            <Card>
              <CardTitle>Live Ticker</CardTitle>
              {latestEvents.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">Noch keine Ereignisse.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {latestEvents.map((event) => (
                    <li key={event.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[var(--muted)]">{formatTime(event.atMs)}</span>
                      <span className="flex-1 text-right">{describeEvent(event)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </section>
    </div>
  );
};

