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
  const [detail, setDetail] = useState<EventRow | null>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (detail) detailDialog.current?.showModal();
    else detailDialog.current?.close();
  }, [detail]);
  const scopes = useMemo(() => sortClubSeasons(seasons), [seasons]);
  const ids = useMemo(() => scopes.map((season) => season.id), [scopes]);
  const bySeason = useMemo(() => new Map(scopes.map((season) => [season.id, season])), [scopes]);
  const feed = useTeamFeedPosts(ids[0] ?? null, null, { teamSeasonIds: ids, skipEnsures: true, chronicleView: true });
  const events = useEvents(ids);
  const eventById = useMemo(() => new Map(events.events.map((event) => [event.id, event])), [events.events]);
  const finished = useMemo(() => new Set(events.events.filter((event) => ["finished", "ended", "completed", "canceled"].includes(event.status ?? "")).map((event) => event.id)), [events.events]);
  const posts = useMemo(() => sortFeedPostsChronologically([...new Map(feed.activePosts.filter((item) => bySeason.has(item.post.team_season_id)).map((item) => [item.post.id, item])).values()]), [feed.activePosts, bySeason]);
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
    <div className="usc-news-heading"><div><h1>Home</h1><p>Neues vom USC Rohrbach</p></div><button type="button" disabled={feed.loading} onClick={() => { void feed.refetch(); void events.refetch(); }}>Aktualisieren</button></div>
    {feed.loading ? <p className="usc-note" role="status">Beiträge werden geladen…</p> : null}
    {feed.error ? <div className="usc-note" role="alert">{feed.error}<button onClick={() => void feed.refetch()}>Erneut laden</button></div> : null}
    {events.error ? <div className="usc-note" role="alert">Verknüpfte Termine konnten nicht geladen werden.<button onClick={() => void events.refetch()}>Termine erneut laden</button></div> : null}
    <div className="usc-club-feed">{posts.map((item) => {
      const season = bySeason.get(item.post.team_season_id)!;
      return <HomeFeedPostRenderer key={item.post.id} item={item} eventById={eventById} finishedEventIds={finished} teamLabel={clubSeasonTeamName(season)} seasonLabel={`${season.age_group} · ${season.season?.name ?? ""}`} staffCanDelete={false} onFeedPostUpdated={() => void feed.refetch()} />;
    })}</div>
    {!feed.loading && !feed.error && !posts.length ? <div className="usc-news-empty"><h2>Noch keine Beiträge</h2><p>Hier erscheinen Spieltag, Kader, Ergebnisse und veröffentlichte Beiträge aus unserem Vereinsleben.</p></div> : null}
    <dialog className="usc-dialog" ref={detailDialog} aria-label="Termindetails" onCancel={() => setDetail(null)} onClose={() => setDetail(null)}>
      <button className="usc-dialog-close" aria-label="Termindetails schließen" onClick={() => setDetail(null)}>×</button>
      {detail ? <><h2>{detail.opponent || "Vereinstermin"}</h2><p>{formatDateTimeMediumDeVienna(detail.starts_at)}</p><p>{detail.location || "Ort noch offen"}</p>{detail.address ? <p>{detail.address}</p> : null}{detail.status === "canceled" ? <p>Abgesagt</p> : null}{detail.notes ? <p className="usc-match-notes">{detail.notes}</p> : null}</> : null}
    </dialog>
  </section>;
}
