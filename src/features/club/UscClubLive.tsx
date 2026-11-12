import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { useEvents, type EventRow } from "../../hooks/useEvents";
import { useMatchClubBranding } from "../../hooks/useMatchClubBranding";
import { usePlayers } from "../../hooks/usePlayers";
import { useMatchTimer } from "../../hooks/useMatchTimer";
import { ClubLogo } from "../../components/branding/ClubLogo";
import { fetchMatchById, fetchMatchEvents, type LiveMatchRow } from "../../lib/liveMatchService";
import { fetchActiveScheduleLiveMatch, type ScheduleActiveLiveMatch } from "../../lib/scheduleActiveLiveMatch";
import { type MatchEngineEvent } from "../../lib/matchEngine";
import { getClubLogo } from "../../lib/teamLogos";
import { clubSeasonTeamName, USC_CLUB_ID, USC_LOGO, type ClubSeason } from "./uscClub";
import { USC_KM_LIGAPORTAL, viennaDay, type useUscLiveMatches } from "./uscLive";

type LiveState = ReturnType<typeof useUscLiveMatches>;
const teamLabel = (season: ClubSeason) => season.age_group === "RES" ? "Reserve" : season.age_group;
const kickoff = (iso: string) => new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" }).format(new Date(iso));
function LiveClock({ match }: { match: LiveMatchRow }) {
  const { currentMatchSeconds } = useMatchTimer({ elapsedSeconds: match.live_elapsed_seconds, isRunning: match.live_is_running, hasEnded: match.status === "finished", startedAtISO: match.live_started_at });
  const knownClock = match.live_elapsed_seconds != null || Boolean(match.live_started_at);
  return <span>{match.status === "finished" ? "Beendet" : !knownClock ? "Live" : !match.live_is_running ? "Pause" : `${Math.floor(currentMatchSeconds / 60)}. Minute`}</span>;
}
function LiveScoreboard({ match, season, events }: { match: LiveMatchRow; season: ClubSeason; events: EventRow[] }) {
  const { brand } = useMatchClubBranding(season.id);
  const [resolved, setResolved] = useState<{ id: string; view: ScheduleActiveLiveMatch | null } | null>(null);
  const event = events.find((e) => e.match_id === match.id && e.team_season_id === season.id);
  useEffect(() => {
    if (event || match.status !== "live") return;
    let active = true;
    void fetchActiveScheduleLiveMatch({ teamSeasonId: season.id, events: [], ourTeamName: clubSeasonTeamName(season), matchIdHint: match.id }).then((view) => { if (active) setResolved({ id: match.id, view }); }).catch(() => { if (active) setResolved({ id: match.id, view: null }); });
    return () => { active = false; };
  }, [event, match.id, match.status, season]);
  const ownName = clubSeasonTeamName(season);
  const ownLogo = brand?.logo_url || (season.team.club_id === USC_CLUB_ID ? USC_LOGO : getClubLogo(ownName));
  const opponentName = event?.opponent || match.opponent || "Gegner noch offen";
  const opponentLogo = getClubLogo(opponentName, { logoUrl: event?.opponent_logo_url });
  const view = resolved?.id === match.id ? resolved.view : null;
  const sides = event ? (event.is_home === false ? [{ name: opponentName, logo: opponentLogo }, { name: ownName, logo: ownLogo }] : [{ name: ownName, logo: ownLogo }, { name: opponentName, logo: opponentLogo }]) : view ? [{ name: view.homeTeamName, logo: view.homeTeamName === ownName ? ownLogo : view.homeLogoUrl }, { name: view.awayTeamName, logo: view.awayTeamName === ownName ? ownLogo : view.awayLogoUrl }] : null;
  return <div className="usc-live-scoreboard">
    {sides ? <>
      <div><ClubLogo src={sides[0].logo || getClubLogo(sides[0].name)} alt="" removeDarkBackground /><strong>{sides[0].name}</strong></div>
      <p className="usc-live-score">{match.score_home ?? "–"}<span>:</span>{match.score_away ?? "–"}</p>
      <div><ClubLogo src={sides[1].logo || getClubLogo(sides[1].name)} alt="" removeDarkBackground /><strong>{sides[1].name}</strong></div>
    </> : <p className="usc-live-pending">{ownName} · {opponentName}<br />Spielzuordnung wird geladen…</p>}
  </div>;
}
function LiveTicker({ matchId, seasons, events, onBack }: { matchId: string; seasons: ClubSeason[]; events: EventRow[]; onBack: () => void }) {
  const [state, setState] = useState<{ match: LiveMatchRow | null; entries: MatchEngineEvent[]; error: string | null; loading: boolean }>({ match: null, entries: [], error: null, loading: true });
  const [retry, setRetry] = useState(0);
  const scope = seasons.map((s) => s.id).join(",");
  useEffect(() => {
    let active = true, serial = 0;
    const refresh = async () => {
      const request = ++serial;
      try {
        const result = await fetchMatchById(matchId);
        if (!active || request !== serial) return;
        // Never load ticker entries for a match outside the selected, authorized club scope.
        if (result.error) throw Error("Das Spiel konnte nicht geladen werden.");
        if (!result.data || !scope.split(",").includes(result.data.team_season_id)) { setState({ match: null, entries: [], error: "Dieses Spiel ist in deiner Mannschaftsauswahl nicht verfügbar.", loading: false }); return; }
        if (!["live", "finished"].includes(result.data.status ?? "")) { setState({ match: null, entries: [], error: "Dieses Spiel hat noch nicht begonnen.", loading: false }); return; }
        const entries = await fetchMatchEvents(matchId);
        if (active && request === serial) setState({ match: result.data, entries: entries.data, error: entries.error ? "Der Spielverlauf konnte nicht geladen werden." : null, loading: false });
      } catch { if (active && request === serial) setState({ match: null, entries: [], error: "Der Liveticker konnte nicht geladen werden.", loading: false }); }
    };
    void refresh();
    const refreshVisible = () => { if (document.visibilityState !== "hidden") void refresh(); };
    const timer = window.setInterval(refreshVisible, 15000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshVisible); };
  }, [matchId, scope, retry]);
  const season = seasons.find((s) => s.id === state.match?.team_season_id);
  const roster = usePlayers(season?.id ?? null);
  const playerName = (id?: string) => id ? roster.players.find((p) => p.id === id)?.display_name : null;
  const labels: Partial<Record<MatchEngineEvent["type"], string>> = { start: "Anpfiff", pause: "Pause", resume: "Spiel fortgesetzt", end: "Abpfiff", goal: "Tor Heimmannschaft", goal_away: "Tor Auswärtsmannschaft", substitution: "Spielerwechsel", sub_in: "Einwechslung", sub_out: "Auswechslung" };
  const entries = state.entries.filter((entry) => labels[entry.type]).slice().sort((a, b) => b.timestamp - a.timestamp || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return <section className="usc-live-hub" aria-label="USC Liveticker">
    <button className="usc-live-back" onClick={onBack}><ArrowLeft size={18} /> Alle Livespiele</button>
    <div className="usc-news-heading"><div><h1>Liveticker</h1><p>Spielverlauf aus der SpielzeitApp</p></div><button onClick={() => setRetry((n) => n + 1)}>Aktualisieren</button></div>
    {state.loading ? <p className="usc-note" role="status">Liveticker wird geladen…</p> : null}
    {state.error ? <p className="usc-note" role="alert">{state.error}<button onClick={() => setRetry((n) => n + 1)}>Erneut laden</button></p> : null}
    {state.match && season ? <><article className="usc-live-card"><div className="usc-live-meta"><strong>{teamLabel(season)}</strong><LiveClock match={state.match} /></div><LiveScoreboard match={state.match} season={season} events={events} /></article><h2 className="usc-live-section-title">Spielverlauf</h2>
      {entries.length ? <ol className="usc-live-timeline">{entries.map((entry) => <li key={entry.id}><time>{Math.floor(entry.timestamp / 60)}′</time><div><strong>{labels[entry.type]}</strong>{playerName(entry.playerId) ? <p>{playerName(entry.playerId)}{playerName(entry.swapWithPlayerId) ? ` → ${playerName(entry.swapWithPlayerId)}` : ""}</p> : null}</div></li>)}</ol> : !state.error ? <p className="usc-note">Noch keine Ereignisse im SpielzeitApp-Ticker eingetragen.</p> : null}
      {season.age_group === "KM" && season.team.club_id === USC_CLUB_ID ? <a className="usc-live-external" href={USC_KM_LIGAPORTAL} target="_blank" rel="noopener noreferrer">KM auf Ligaportal verfolgen <ArrowUpRight size={15} /><span className="sr-only"> (externer Spielplan und Liveticker der Gebietsliga West)</span></a> : null}
    </> : null}
  </section>;
}
export function UscClubLive({ seasons, live, onOpenTeamFilter }: { seasons: ClubSeason[]; live: LiveState; onOpenTeamFilter: () => void }) {
  const [params, setParams] = useSearchParams();
  const [team, setTeam] = useState<string | null>(null);
  const [today, setToday] = useState(() => viennaDay(Date.now()));
  const ids = useMemo(() => seasons.map((s) => s.id), [seasons]);
  const calendar = useEvents(ids);
  useEffect(() => { const timer = window.setInterval(() => setToday(viennaDay(Date.now())), 60000); return () => window.clearInterval(timer); }, []);
  const selectedId = team && ids.includes(team) ? team : null;
  const filtered = seasons.filter((s) => !selectedId || s.id === selectedId);
  const visible = new Set(filtered.map((s) => s.id));
  const rows = live.rows.filter((m) => visible.has(m.team_season_id));
  const games = calendar.events.filter((e) => visible.has(e.team_season_id) && (e.type === "game" || e.kind === "match") && e.status !== "canceled").sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const todays = games.filter((e) => viennaDay(e.starts_at) === today && !live.rows.some((m) => m.id === e.match_id));
  const next = games.find((e) => Date.parse(e.starts_at) > Date.now() && !live.rows.some((m) => m.id === e.match_id));
  const openMatch = (id: string | null) => { setParams((previous) => { const next = new URLSearchParams(previous); if (id) next.set("liveMatch", id); else next.delete("liveMatch"); return next; }); };
  const openEvent = (event: EventRow) => { setParams((previous) => { const next = new URLSearchParams(previous); next.set("tab", "spiele"); next.set("teamSeason", event.team_season_id); next.set("event", event.id); next.delete("liveMatch"); return next; }); };
  if (params.get("liveMatch")) return <LiveTicker key={params.get("liveMatch")!} matchId={params.get("liveMatch")!} seasons={seasons} events={calendar.events} onBack={() => openMatch(null)} />;
  return <section className="usc-live-hub" aria-label="USC Liveübersicht">
    <div className="usc-news-heading"><div><h1>Live</h1><p>Heute beim USC · deine Mannschaftsauswahl</p></div><button disabled={live.loading || calendar.loading} onClick={() => { live.refetch(); void calendar.refetch(); }}>Aktualisieren</button></div>
    <div className="usc-live-team-chips" role="group" aria-label="Livespiele nach Mannschaft filtern"><button aria-pressed={!selectedId} onClick={() => setTeam(null)}>Alle</button>{seasons.map((s) => <button key={s.id} aria-pressed={selectedId === s.id} onClick={() => setTeam(s.id)}>{teamLabel(s)}</button>)}</div>
    {!seasons.length ? <div className="usc-news-empty"><h2>Keine Mannschaft ausgewählt</h2><button className="usc-action" onClick={onOpenTeamFilter}>Mannschaften auswählen</button></div> : null}
    {live.loading ? <p className="usc-note" role="status">Livespiele werden geladen…</p> : live.error ? <p className="usc-note" role="alert">Livespiele konnten nicht geladen werden.<button onClick={live.refetch}>Erneut laden</button></p> : rows.length ? rows.map((match) => {
      const season = seasons.find((s) => s.id === match.team_season_id)!;
      return <article className="usc-live-card" key={match.id}><div className="usc-live-meta"><strong>{teamLabel(season)} · <LiveClock match={match} /></strong><span className="usc-live-badge">● LIVE</span></div><LiveScoreboard match={match} season={season} events={calendar.events} /><button className="usc-action" onClick={() => openMatch(match.id)}>Zum Liveticker <ChevronRight size={16} /></button></article>;
    }) : seasons.length ? <div className="usc-news-empty"><h2>Gerade kein Livespiel</h2><p>Hier erscheinen die laufenden Spiele deiner ausgewählten Mannschaften.</p></div> : null}
    {calendar.error ? <p className="usc-note" role="alert">Spieltermine konnten nicht geladen werden.<button onClick={() => void calendar.refetch()}>Erneut laden</button></p> : null}
    {todays.length ? <><h2 className="usc-live-section-title">Weitere Spiele heute</h2>{todays.map((e) => <button key={e.id} className="usc-live-upcoming" onClick={() => openEvent(e)}><span><strong>{teamLabel(seasons.find((s) => s.id === e.team_season_id)!)}</strong> · {e.opponent}<small>{e.status === "finished" ? "Beendet · Zum Spielbericht" : kickoff(e.starts_at)}</small></span><ChevronRight size={18} /></button>)}</> : !calendar.loading && !calendar.error && next && !rows.length ? <><h2 className="usc-live-section-title">Nächstes Spiel</h2><button className="usc-live-upcoming" onClick={() => openEvent(next)}><span><strong>{teamLabel(seasons.find((s) => s.id === next.team_season_id)!)}</strong> · {next.opponent}<small>{new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", timeZone: "Europe/Vienna" }).format(new Date(next.starts_at))} · {kickoff(next.starts_at)}</small></span><ChevronRight size={18} /></button></> : null}
    {filtered.some((s) => s.age_group === "KM" && s.team.club_id === USC_CLUB_ID) ? <a className="usc-live-external" href={USC_KM_LIGAPORTAL} target="_blank" rel="noopener noreferrer">KM auf Ligaportal verfolgen <ArrowUpRight size={15} /><span className="sr-only"> (externer Spielplan und Liveticker der Gebietsliga West)</span></a> : null}
    <p className="usc-live-refresh-note">SpielzeitApp-Livespiele · automatische Aktualisierung</p>
  </section>;
}
