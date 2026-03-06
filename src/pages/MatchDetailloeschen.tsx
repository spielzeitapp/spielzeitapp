import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { useMatchEngine } from '../match/useMatchEngine';
import type { MatchEvent } from '../match/events';
import { Pill } from '../app/components/ui/Pill';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Button } from '../app/components/ui/Button';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePlayers } from '../hooks/usePlayers';
import { supabase } from '../lib/supabaseClient';
import type { PlayerItem } from '../hooks/usePlayers';

type TabId = 'info' | 'live' | 'kader';

/** Match aus public.matches (Supabase). */
type MatchRow = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  match_date: string | null;
  location: string | null;
  status: string | null;
  motm_enabled?: boolean | null;
  motm_open_until?: string | null;
};

function statusLabel(status: string | null) {
  const s = (status ?? '').toLowerCase();
  if (s === 'upcoming') return 'Bevorstehend';
  if (s === 'live') return 'Live';
  if (s === 'finished') return 'Beendet';
  if (s === 'not-started') return 'Nicht gestartet';
  return status ?? '–';
}

function pillVariant(status: string | null): 'live' | 'upcoming' | 'finished' | 'not-started' {
  const s = (status ?? '').toLowerCase();
  if (s === 'live') return 'live';
  if (s === 'upcoming') return 'upcoming';
  if (s === 'not-started') return 'not-started';
  return 'finished';
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatMatchDateTime(iso: string | null): { dateStr: string; timeStr: string } {
  if (!iso) return { dateStr: '–', timeStr: '–' };
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  return { dateStr, timeStr };
}

function isCoachRole(role: string | null): boolean {
  const r = (role ?? '').toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach' || r === 'admin';
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

export const MatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useSession();
  const { teamLabel, teamSeasonId, loading: tsLoading, error: tsError } = useActiveTeamSeason();
  const { players, loading: playersLoading, error: playersError } = usePlayers(teamSeasonId);

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('info');

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
      .select('id, team_season_id, opponent, match_date, location, status, motm_enabled, motm_open_until')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setMatchError(error.message);
          setMatch(null);
        } else {
          setMatch(data as MatchRow | null);
        }
        setMatchLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const loading = tsLoading || matchLoading;
  const error = tsError ?? matchError;
  const showLiveTab = match ? (match.status === 'live' || isCoachRole(role)) : false;

  if (loading && !match) {
    return (
      <div className="page space-y-4 pb-4">
        <Link to="/schedule" className="text-sm text-[var(--text-sub)] hover:text-[var(--text-main)]">
          ← Zurück zum Spielplan
        </Link>
        <p className="text-sm text-[var(--text-sub)]">Lade Spiel…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page space-y-4 pb-4">
        <Link to="/schedule" className="text-sm text-[var(--text-sub)] hover:text-[var(--text-main)]">
          ← Zurück zum Spielplan
        </Link>
        <p className="text-sm text-red-600" role="alert">{error}</p>
      </div>
    );
  }

  if (!match || !id) {
    return (
      <div className="page space-y-4 pb-4">
        <Link to="/schedule" className="text-sm text-[var(--text-sub)] hover:text-[var(--text-main)]">
          ← Zurück zum Spielplan
        </Link>
        <p className="text-[var(--text-sub)]">Spiel nicht gefunden.</p>
      </div>
    );
  }

  const { dateStr, timeStr } = formatMatchDateTime(match.match_date);
  const teamName = teamLabel ?? 'Team';

  return (
    <div className="page space-y-4 pb-4">
      <Link to="/schedule" className="text-sm text-[var(--text-sub)] hover:text-[var(--text-main)]">
        ← Zurück zum Spielplan
      </Link>

      <div className="matchcard">
        <div className="matchgrid">
          <div className="matchmeta matchmeta--team">
            <p className="text-sm font-medium text-[var(--text-main)]">{teamName}</p>
            <span className="matchcard__score">0</span>
          </div>
          <div className="matchmeta">
            <span className="matchcard__time">{timeStr}</span>
            <Pill variant={pillVariant(match.status)} className="mt-1">
              {statusLabel(match.status)}
            </Pill>
            <p className="text-xs text-[var(--text-sub)] mt-0.5">{dateStr}</p>
          </div>
          <div className="matchmeta matchmeta--opponent">
            <p className="text-sm font-medium text-[var(--text-main)]">{match.opponent ?? 'Gegner'}</p>
            <span className="matchcard__score">0</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-[var(--glass-border)] pb-2">
        {(['info', 'live', 'kader'] as const).map((tab) => {
          if (tab === 'live' && !showLiveTab) return null;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-[var(--glass-bg)]'
              }`}
            >
              {tab === 'info' && 'Info'}
              {tab === 'live' && 'Live'}
              {tab === 'kader' && 'Kader'}
            </button>
          );
        })}
      </div>

      {activeTab === 'info' && (
        <Card>
          <CardTitle>Allgemeine Infos</CardTitle>
          <dl className="mt-2 space-y-2 text-sm">
            <div>
              <dt className="text-[var(--text-sub)]">Datum</dt>
              <dd className="text-[var(--text-main)]">{dateStr}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-sub)]">Uhrzeit</dt>
              <dd className="text-[var(--text-main)]">{timeStr}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-sub)]">Ort</dt>
              <dd className="text-[var(--text-main)]">{match.location ?? '–'}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-sub)]">Treffpunkt</dt>
              <dd className="text-[var(--text-main)]">– (Placeholder)</dd>
            </div>
            <div>
              <dt className="text-[var(--text-sub)]">Hinweise Trainer</dt>
              <dd className="text-[var(--text-main)]">– (Placeholder)</dd>
            </div>
          </dl>
        </Card>
      )}

      {activeTab === 'live' && showLiveTab && (
        <MatchDetailLiveTab matchId={id} match={match} players={players} />
      )}

      {activeTab === 'kader' && (
        <Card>
          <CardTitle>Kader</CardTitle>
          {playersLoading && <p className="mt-2 text-sm text-[var(--text-sub)]">Lade Kader…</p>}
          {playersError && <p className="mt-2 text-sm text-red-600" role="alert">{playersError}</p>}
          {!playersLoading && !playersError && players.length === 0 && (
            <p className="mt-2 text-sm text-[var(--text-sub)]">Noch keine Spieler erfasst.</p>
          )}
          {!playersLoading && !playersError && players.length > 0 && (
            <ul className="mt-2 space-y-2 text-sm text-[var(--text-main)]">
              {players.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.display_name || "Spieler"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
};

function MatchDetailLiveTab({
  matchId,
  match,
  players,
}: {
  matchId: string;
  match: MatchRow;
  players: PlayerItem[];
}) {
  const { canAccess } = useSession();
  const isAdmin = canAccess('match_admin');
  const { state, log, dispatchEvent } = useMatchEngine(matchId);

  const elapsedMs =
    state
      ? state.clock.elapsedMs +
        (state.clock.isRunning && state.clock.startedAt ? Date.now() - state.clock.startedAt : 0)
      : 0;
  const latestEvents = log.slice(-10).reverse();
  const scoreHome = state?.scoreHome ?? 0;
  const scoreAway = state?.scoreAway ?? 0;

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

  const motmVotingOpen =
    match.status === 'live' &&
    (!match.motm_open_until || Date.now() <= new Date(match.motm_open_until).getTime());
  const motmPlayers = players.slice(0, 5);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Zu-/Absage</CardTitle>
        <p className="mt-1 text-sm text-[var(--text-sub)]">Placeholder: Zu-/Absage (folgt).</p>
      </Card>

      <div className="matchcard">
        <div className="matchgrid">
          <div className="matchmeta matchmeta--team">
            <p className="text-sm font-medium text-[var(--text-main)]">Heim</p>
            <span className="matchcard__score">{scoreHome}</span>
          </div>
          <div className="matchmeta">
            <span className="matchcard__time" style={{ fontSize: '1.5rem' }}>
              {formatTime(elapsedMs)}
            </span>
            <p className="text-xs text-[var(--text-sub)] mt-1">Periode {state?.period ?? 1}</p>
          </div>
          <div className="matchmeta matchmeta--opponent">
            <p className="text-sm font-medium text-[var(--text-main)]">{match.opponent ?? 'Gegner'}</p>
            <p className="text-xs text-[var(--text-sub)]">Gast</p>
            <span className="matchcard__score">{scoreAway}</span>
          </div>
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardTitle>Match Engine (Admin)</CardTitle>
          <div className="matchcard__actions mt-4">
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

      {match.motm_enabled === true && (
        <Card>
          <CardTitle>Player of the Match</CardTitle>
          {motmVotingOpen ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-[var(--text-sub)]">Wähle deinen Spieler des Spiels:</p>
              <div className="flex flex-wrap gap-2">
                {motmPlayers.length > 0 ? (
                  motmPlayers.map((p) => (
                    <Button key={p.id} type="button" variant="secondary" size="sm" onClick={() => {}}>
                      {p.display_name || "Spieler"}
                    </Button>
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-sub)]">Keine Spieler im Kader.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm font-medium text-[var(--text-sub)]">Voting beendet</p>
              <p className="mt-1 text-sm text-[var(--text-main)]">Spieler des Spiels: – (Ergebnis folgt)</p>
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardTitle>Live Ticker</CardTitle>
        {latestEvents.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--text-sub)]">Noch keine Ereignisse.</p>
        ) : (
          <ul className="ticker-list mt-2">
            {latestEvents.map((event) => (
              <li key={event.id} className="ticker-list__item">
                <span className="ticker-list__time">{formatTime(event.atMs)}</span>
                <span>{describeEvent(event)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
