import { SlidersHorizontal, X } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HomeFeedPostRenderer } from "../../components/feed/HomeFeedPostRenderer";
import { useEvents, type EventRow } from "../../hooks/useEvents";
import { useTeamFeedPosts } from "../../hooks/useTeamFeedPosts";
import { sortFeedPostsChronologically } from "../../lib/feedPostPriority";
import { sortClubSeasons, clubSeasonTeamName, type ClubSeason } from "./uscClub";
import { formatDateTimeMediumDeVienna } from "../../lib/notifications/format";
import { uscEventLink } from "./uscEventLink";

/** Read the authorized club feeds together; visiting Home never publishes posts. */
export function UscClubNewsHome({ seasons }: { seasons: ClubSeason[] }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const filterKey = user?.id ? `spz_usc_news_teams_${user.id}` : null;
  const [selected, setSelected] = useState<string[] | null>(() => {
    try {
      if (!filterKey || typeof window === "undefined") return null;
      const saved: unknown = JSON.parse(window.localStorage.getItem(filterKey) ?? "null");
      return Array.isArray(saved) && saved.every((id) => typeof id === "string") ? [...new Set(saved)] : null;
    } catch { return null; }
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const filterDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (filterOpen) filterDialog.current?.showModal();
    else filterDialog.current?.close();
  }, [filterOpen]);
  const [detail, setDetail] = useState<EventRow | null>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (detail) detailDialog.current?.showModal();
    else detailDialog.current?.close();
  }, [detail]);
  const scopes = useMemo(() => sortClubSeasons(seasons), [seasons]);
  const ids = useMemo(() => scopes.map((season) => season.id), [scopes]);
  const visibleIds = useMemo(() => {
    if (selected == null) return ids;
    const allowed = selected.filter((id) => ids.includes(id));
    // A new season must not leave an old non-empty saved filter showing nothing.
    return selected.length && !allowed.length ? ids : allowed;
  }, [selected, ids]);
  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const teamLabel = (season: ClubSeason) => season.age_group === "RES" ? "Reserve" : season.age_group || season.team.name;
  const allSelected = visibleIds.length === ids.length;
  const openFilter = () => { setDraft(visibleIds); setFilterOpen(true); };
  const applyFilter = () => {
    const next = draft.length === ids.length ? null : ids.filter((id) => draft.includes(id));
    setSelected(next);
    try { if (filterKey && typeof window !== "undefined") window.localStorage.setItem(filterKey, JSON.stringify(next)); } catch { /* Storage may be unavailable; keep this session's selection. */ }
    setFilterOpen(false);
  };
  const bySeason = useMemo(() => new Map(scopes.map((season) => [season.id, season])), [scopes]);
  const feed = useTeamFeedPosts(ids[0] ?? null, null, { teamSeasonIds: ids, skipEnsures: true, chronicleView: true });
  const events = useEvents(ids);
  const eventById = useMemo(() => new Map(events.events.map((event) => [event.id, event])), [events.events]);
  const finished = useMemo(() => new Set(events.events.filter((event) => ["finished", "ended", "completed", "canceled"].includes(event.status ?? "")).map((event) => event.id)), [events.events]);
  const posts = useMemo(() => sortFeedPostsChronologically([...new Map(feed.activePosts.filter((item) => bySeason.has(item.post.team_season_id) && visibleSet.has(item.post.team_season_id)).map((item) => [item.post.id, item])).values()]), [feed.activePosts, bySeason, visibleSet]);
  const keepClubNavigation = (event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest("a[href]");
    const href = anchor?.getAttribute("href");
    if (!href || anchor?.getAttribute("target") === "_blank" || anchor?.hasAttribute("download")) return;
    for (const season of scopes) {
      const target = uscEventLink(href, events.events, season.id);
      if (target) {
        event.preventDefault();
        const id = new URLSearchParams(target.split("?")[1]).get("event");
        const linked = events.events.find((item) => item.id === id);
        if (linked && linked.type !== "game" && linked.kind !== "match") setDetail(linked);
        else navigate(target);
        return;
      }
    }
  };
  return <section className="usc-news-home" aria-label="Vereinsnews" onClickCapture={keepClubNavigation}>
    <div className="usc-news-heading"><div><h1>Home</h1><p>{allSelected ? "Neues vom USC Rohrbach" : scopes.filter((season) => visibleSet.has(season.id)).map(teamLabel).join(" · ") || "Keine Mannschaft ausgewählt"}</p></div><div className="usc-news-tools"><button type="button" className={`usc-icon-button usc-news-filter-button ${allSelected ? "" : "usc-news-filter-active"}`} aria-label="Mannschaften filtern" aria-haspopup="dialog" aria-expanded={filterOpen} onClick={openFilter}><SlidersHorizontal size={21} />{!allSelected ? <span>{visibleIds.length}</span> : null}</button><button type="button" disabled={feed.loading} onClick={() => { void feed.refetch(); void events.refetch(); }}>Aktualisieren</button></div></div>
    <dialog className="usc-dialog usc-news-filter" ref={filterDialog} aria-label="Mannschaften im Feed" onCancel={() => setFilterOpen(false)} onClose={() => setFilterOpen(false)}>
      <button type="button" className="usc-dialog-close" aria-label="Mannschaftsfilter schließen" onClick={() => setFilterOpen(false)}><X /></button>
      <h2>Deine Mannschaften im Feed</h2><p>Wähle, welche Beiträge du auf Home sehen möchtest.</p>
      <div className="usc-filter-shortcuts"><button type="button" onClick={() => setDraft(ids)}>Alle auswählen</button><button type="button" onClick={() => setDraft([])}>Alle abwählen</button></div>
      <fieldset><legend className="sr-only">Mannschaften auswählen</legend>{scopes.map((season) => <label key={season.id} className="usc-filter-team"><input type="checkbox" checked={draft.includes(season.id)} onChange={(event) => setDraft((previous) => event.target.checked ? [...new Set([...previous, season.id])] : previous.filter((id) => id !== season.id))} /><span><strong>{teamLabel(season)}</strong><small>{clubSeasonTeamName(season)} · {season.season?.name}</small></span></label>)}</fieldset>
      <button type="button" className="usc-action" onClick={applyFilter}>Auswahl übernehmen</button>
      <p className="usc-filter-hint">Die Auswahl wird für dein Konto auf diesem Gerät gespeichert.</p>
    </dialog>
    {feed.loading ? <p className="usc-note" role="status">Beiträge werden geladen…</p> : null}
    {feed.error ? <div className="usc-note" role="alert">{feed.error}<button onClick={() => void feed.refetch()}>Erneut laden</button></div> : null}
    {events.error ? <div className="usc-note" role="alert">Verknüpfte Termine konnten nicht geladen werden.<button onClick={() => void events.refetch()}>Termine erneut laden</button></div> : null}
    <div className="usc-club-feed">{posts.map((item) => {
      const season = bySeason.get(item.post.team_season_id)!;
      return <HomeFeedPostRenderer key={item.post.id} item={item} eventById={eventById} finishedEventIds={finished} teamLabel={clubSeasonTeamName(season)} seasonLabel={`${season.age_group} · ${season.season?.name ?? ""}`} staffCanDelete={false} onFeedPostUpdated={() => void feed.refetch()} />;
    })}</div>
    {!feed.loading && !feed.error && !posts.length ? <div className="usc-news-empty"><h2>{visibleIds.length ? "Noch keine Beiträge für diese Auswahl" : "Keine Mannschaft ausgewählt"}</h2><p>Wähle deine Mannschaften, um ihre Spieltage, Kader, Ergebnisse und Vereinsbeiträge zu sehen.</p><button className="usc-action" onClick={openFilter}>Mannschaften auswählen</button></div> : null}
    <dialog className="usc-dialog" ref={detailDialog} aria-label="Termindetails" onCancel={() => setDetail(null)} onClose={() => setDetail(null)}>
      <button className="usc-dialog-close" aria-label="Termindetails schließen" onClick={() => setDetail(null)}>×</button>
      {detail ? <><h2>{detail.opponent || "Vereinstermin"}</h2><p>{formatDateTimeMediumDeVienna(detail.starts_at)}</p><p>{detail.location || "Ort noch offen"}</p>{detail.address ? <p>{detail.address}</p> : null}{detail.status === "canceled" ? <p>Abgesagt</p> : null}{detail.notes ? <p className="usc-match-notes">{detail.notes}</p> : null}</> : null}
    </dialog>
  </section>;
}
