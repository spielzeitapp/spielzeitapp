import { uscEventLink } from "./uscEventLink";
import { UscMatchReport } from "./UscMatchReport";
import { uscAuthPath } from "./uscAuth";
import { isStagingApp } from "../../lib/appEnvironment";
import { OefbCompetitionTable } from "../../components/schedule/OefbCompetitionTable";
import {
  getOefbTableSettings,
  type OefbTableSettings,
} from "../../lib/oefbTableSettings";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Home,
  Menu,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { useEvents, type EventRow } from "../../hooks/useEvents";
import { useTeamFeedPosts } from "../../hooks/useTeamFeedPosts";
import { usePlayers, type PlayerItem } from "../../hooks/usePlayers";
import {
  useTeamStaff,
  staffDisplayName,
  staffRoleLabelDe,
} from "../../hooks/useTeamStaff";
import { supabase } from "../../lib/supabaseClient";
import { ClubLogo } from "../../components/branding/ClubLogo";
import { HomeFeedPostRenderer } from "../../components/feed/HomeFeedPostRenderer";
import { PlayerProfileModal } from "../../components/team/PlayerProfileModal";
import { ProfileHeroCard } from "../../components/team/profile/ProfileHeroCard";
import {
  teamPhotoImageStyle,
  type TeamPhotoLayout,
} from "../../lib/teamPhotoLayout";
import { getClubLogo } from "../../lib/teamLogos";
import { formatFeedVenueShort } from "../../lib/eventLocation";
import { getMatchTypeLabel } from "../../components/match/matchCardLabels";
import {
  USC_APP_PATH,
  USC_LOGO,
  USC_APP_ICON,
  clubTab,
  type ClubTab,
  type ClubSeason,
} from "./uscClub";
import { useUscClub } from "./useUscClub";
import "./uscClubApp.css";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "spiele", label: "Spiele", icon: CalendarDays },
  { id: "teams", label: "Teams", icon: Users },
  { id: "verein", label: "Verein", icon: Shield },
] as const;
const date = (iso: string) =>
  new Intl.DateTimeFormat("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Vienna",
  }).format(new Date(iso));
const time = (iso: string) =>
  new Intl.DateTimeFormat("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vienna",
  }).format(new Date(iso));
type Score = {
  id: string;
  status: string;
  score_home: number | null;
  score_away: number | null;
};
type Photo = TeamPhotoLayout & { photo_url: string };

function ClubMatch({
  event,
  score,
  onOpen,
  hero = false,
}: {
  event: EventRow;
  score?: Score;
  onOpen?: () => void;
  hero?: boolean;
}) {
  const finished =
    score?.status === "finished" &&
    score.score_home != null &&
    score.score_away != null;
  const own = { name: "USC Rohrbach", logo: USC_LOGO };
  const opponent = {
    name: (event.opponent || "Gegner noch offen").replace(/\s*-\s*/g, "-"),
    logo: getClubLogo(event.opponent || "", {
      logoUrl: event.opponent_logo_url,
    }),
  };
  const sides = event.is_home === false ? [opponent, own] : [own, opponent];
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      className={`usc-match ${hero ? "usc-match--hero" : ""}`}
      onClick={onOpen}
      {...(onOpen ? { type: "button" as const } : {})}
    >
      <span className="usc-eyebrow">
        {hero
          ? "Nächstes Spiel"
          : finished
            ? "Endstand"
            : event.status === "canceled"
              ? "Abgesagt"
              : "Spieltermin"}{" "}
        · {getMatchTypeLabel(event.match_type) || "Spiel"}
      </span>
      <span className="usc-match-date">
        {date(event.starts_at)} ·{" "}
        {event.is_home === false ? "Auswärts" : "Heimspiel"}
      </span>
      <span className="usc-encounter">
        <span className="usc-match-team">
          <ClubLogo src={sides[0].logo} removeDarkBackground alt="" />
          <strong>{sides[0].name}</strong>
        </span>
        <span className="usc-match-score">
          {finished
            ? `${score.score_home}:${score.score_away}`
            : time(event.starts_at)}
          <small>{finished ? "Spiel beendet" : "Anpfiff"}</small>
        </span>
        <span className="usc-match-team">
          <ClubLogo src={sides[1].logo} removeDarkBackground alt="" />
          <strong>{sides[1].name}</strong>
        </span>
      </span>
      <span className="usc-match-venue">
        {formatFeedVenueShort(event.location) || "Spielort noch offen"}
        <ChevronRight size={17} />
      </span>
    </Tag>
  );
}

function ClubSeasonContent({
  season,
  tab,
  setTab,
}: {
  season: ClubSeason;
  tab: ClubTab;
  setTab: (tab: ClubTab) => void;
}) {
  const navigate = useNavigate();
  const [routeParams, setRouteParams] = useSearchParams();
  const eventQuery = routeParams.get("event");
  const openDetail = (event: EventRow) =>
    setRouteParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("event", event.id);
      return next;
    });
  const closeDetail = () => {
    setDetail(null);
    if (eventQuery)
      setRouteParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete("event");
          return next;
        },
        { replace: true },
      );
  };

  const {
    events,
    loading: eventsLoading,
    error: eventError,
    refetch: reloadEvents,
  } = useEvents(season.id);
  const feed = useTeamFeedPosts(season.id, season.team_id, {
    skipEnsures: true,
  });
  const roster = usePlayers(tab === "teams" ? season.id : null);
  const staff = useTeamStaff(tab === "teams" ? season.id : null);
  const [player, setPlayer] = useState<PlayerItem | null>(null);
  const [detail, setDetail] = useState<EventRow | null>(null);
  useEffect(() => {
    setDetail(
      eventQuery
        ? (events.find(
            (e) => e.id === eventQuery && e.team_season_id === season.id,
          ) ?? null)
        : null,
    );
  }, [eventQuery, events, season.id]);
  const keepClubNavigation = (e: React.MouseEvent<HTMLElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    const anchor = (e.target as Element).closest("a[href]");
    const href = anchor?.getAttribute("href");
    if (!href) return;
    const target = uscEventLink(href, events, season.id);
    if (target) {
      e.preventDefault();
      setPlayer(null);
      navigate(target);
    }
  };
  const [scores, setScores] = useState<Map<string, Score>>(new Map());
  const [scoreError, setScoreError] = useState(false);
  const [scoreRetry, setScoreRetry] = useState(0);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [table, setTable] = useState<{
    loading: boolean;
    settings: OefbTableSettings | null;
    error: string | null;
  }>({ loading: true, settings: null, error: null });
  useEffect(() => {
    if (tab !== "tabelle") return;
    let active = true;
    void getOefbTableSettings(season.id)
      .then((result) => {
        if (active)
          setTable({
            loading: false,
            settings: result.data,
            error: result.error,
          });
      })
      .catch(() => {
        if (active)
          setTable({
            loading: false,
            settings: null,
            error: "Tabelle konnte nicht geladen werden.",
          });
      });
    return () => {
      active = false;
    };
  }, [season.id, tab]);
  const [filter, setFilter] = useState<"alle" | "kommende" | "vergangene">(
    "alle",
  );
  const [rosterTab, setRosterTab] = useState<"kader" | "trainer">("kader");
  const [search, setSearch] = useState("");
  const matchDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    void supabase
      .from("team_photos")
      .select(
        "photo_url,photo_zoom,photo_position_x,photo_position_y,photo_brightness",
      )
      .eq("team_season_id", season.id)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (active) setPhoto(data as Photo | null);
        },
        () => {
          if (active) setPhoto(null);
        },
      );
    return () => {
      active = false;
    };
  }, [season.id]);
  useEffect(() => {
    const ids = events
      .map((e) => e.match_id)
      .filter((id): id is string => Boolean(id));
    if (!ids.length) {
      setScores(new Map());
      return;
    }
    let active = true;
    setScoreError(false);
    void supabase
      .from("matches")
      .select("id,status,score_home,score_away")
      .in("id", ids)
      .then(
        ({ data, error }) => {
          if (active) {
            setScores(new Map(((data ?? []) as Score[]).map((s) => [s.id, s])));
            setScoreError(Boolean(error));
          }
        },
        () => {
          if (active) setScoreError(true);
        },
      );
    return () => {
      active = false;
    };
  }, [events, scoreRetry]);
  useEffect(() => {
    if (detail) matchDialog.current?.showModal();
    else matchDialog.current?.close();
  }, [detail]);
  const matches = useMemo(
    () =>
      events
        .filter((e) => e.type === "game" || e.kind === "match")
        .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at)),
    [events],
  );
  const next = useMemo(
    () =>
      matches
        .filter(
          (e) =>
            Date.parse(e.starts_at) > Date.now() &&
            e.status !== "canceled" &&
            scores.get(e.match_id || "")?.status !== "finished",
        )
        .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0],
    [matches, scores],
  );
  const visibleMatches = matches.filter(
    (e) =>
      filter === "alle" ||
      (filter === "kommende"
        ? Date.parse(e.starts_at) >= Date.now()
        : Date.parse(e.starts_at) < Date.now()),
  );
  if (filter === "kommende")
    visibleMatches.sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
    );
  const eventById = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events],
  );
  const finished = useMemo(
    () =>
      new Set(
        events
          .filter(
            (e) =>
              e.status === "finished" ||
              scores.get(e.match_id || "")?.status === "finished",
          )
          .map((e) => e.id),
      ),
    [events, scores],
  );
  const players = roster.players.filter((p) =>
    p.display_name
      .toLocaleLowerCase("de")
      .includes(search.toLocaleLowerCase("de")),
  );
  return (
    <div className="usc-season-content" onClickCapture={keepClubNavigation}>
      {tab === "home" ? (
        <>
          <section className="usc-hero">
            <div className="usc-hero-image">
              {photo ? (
                <img
                  className="usc-hero-photo"
                  src={photo.photo_url}
                  style={teamPhotoImageStyle(photo)}
                  alt="Mannschaft des USC Rohrbach"
                />
              ) : (
                <div className="usc-hero-fallback" />
              )}
            </div>
            <div className="usc-hero-copy">
              <span className="usc-eyebrow">
                Unser Verein. Unser Team.
              </span>
              <h1>USC Rohrbach</h1>
              <p>
                {season.age_group} · Saison {season.season?.name}
              </p>
            </div>
          </section>
          <div className="usc-section-head">
            <h2>Nächstes Spiel</h2>
            <button onClick={() => setTab("spiele")}>
              Alle Spiele <ChevronRight size={16} />
            </button>
          </div>
          {eventsLoading ? (
            <p className="usc-note" role="status">
              Spiele werden geladen…
            </p>
          ) : next ? (
            <ClubMatch
              event={next}
              score={scores.get(next.match_id || "")}
              onOpen={() => openDetail(next)}
              hero
            />
          ) : (
            <p className="usc-note">
              Aktuell ist kein kommendes Spiel eingetragen.
            </p>
          )}
          <div className="usc-section-head">
            <h2>Aktuelles</h2>
            <span className="usc-eyebrow">{season.age_group}</span>
          </div>
          {feed.loading ? (
            <p className="usc-note" role="status">
              Beiträge werden geladen…
            </p>
          ) : feed.error ? (
            <div className="usc-note" role="alert">
              {feed.error}
              <button onClick={() => void feed.refetch()}>Erneut laden</button>
            </div>
          ) : feed.activePosts.length ? (
            <div className="usc-club-feed">
              {feed.activePosts.map((item) => (
                <HomeFeedPostRenderer
                  key={item.post.id}
                  item={item}
                  eventById={eventById}
                  finishedEventIds={finished}
                  teamLabel="USC Rohrbach"
                  seasonLabel={season.season?.name}
                  staffCanDelete={false}
                />
              ))}
            </div>
          ) : (
            <p className="usc-note">
              Noch keine Beiträge für diese Mannschaft vorhanden.
            </p>
          )}
        </>
      ) : null}
      {tab === "spiele" ? (
        <>
          <div className="usc-page-title">
            <span className="usc-eyebrow">
              {season.age_group} · {season.season?.name}
            </span>
            <h1>Spiele.</h1>
            <p>Spielplan und Ergebnisse aus deiner SpielzeitApp.</p>
          </div>
          <div className="usc-tabs" aria-label="Spiele filtern">
            {(["alle", "kommende", "vergangene"] as const).map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          {eventsLoading ? (
            <p className="usc-note" role="status">
              Spiele werden geladen…
            </p>
          ) : eventError ? (
            <p className="usc-note" role="alert">
              {eventError}
              <button onClick={() => void reloadEvents()}>Erneut laden</button>
            </p>
          ) : (
            <div className="usc-match-list">
              {visibleMatches.map((event) => (
                <ClubMatch
                  key={event.id}
                  event={event}
                  score={scores.get(event.match_id || "")}
                  onOpen={() => openDetail(event)}
                />
              ))}
              {!visibleMatches.length ? (
                <p className="usc-note">Keine Spiele in dieser Auswahl.</p>
              ) : null}
            </div>
          )}
        </>
      ) : null}
      {scoreError && (tab === "home" || tab === "spiele") ? (
        <p className="usc-note" role="alert">
          Ergebnisse konnten nicht geladen werden.
          <button onClick={() => setScoreRetry((n) => n + 1)}>
            Ergebnisse erneut laden
          </button>
        </p>
      ) : null}
      {tab === "tabelle" ? (
        <section className="usc-table">
          <div className="usc-page-title">
            <span className="usc-eyebrow">
              {season.age_group} · {season.season?.name}
            </span>
            <h1>Tabelle.</h1>
          </div>
          {table.loading ? (
            <p className="usc-note" role="status">
              Tabellenzuordnung wird geladen…
            </p>
          ) : table.error ? (
            <p className="usc-note" role="alert">
              {table.error}
            </p>
          ) : table.settings ? (
            <OefbCompetitionTable
              {...table.settings}
              ourTeam={table.settings.teamName}
              teamSeasonId={season.id}
            />
          ) : (
            <p className="usc-note">
              Für diese Mannschaft ist noch keine Tabelle hinterlegt.
            </p>
          )}
        </section>
      ) : null}
      {tab === "teams" ? (
        <>
          <div className="usc-page-title">
            <span className="usc-eyebrow">{season.season?.name}</span>
            <h1>
              {season.age_group === "KM"
                ? "Kampfmannschaft"
                : season.age_group === "RES"
                  ? "Reserve"
                  : season.age_group}
            </h1>
            <p>Unser Team · {roster.players.length} Spieler</p>
          </div>
          <div className="usc-tabs">
            <button
              aria-pressed={rosterTab === "kader"}
              onClick={() => setRosterTab("kader")}
            >
              Kader
            </button>
            <button
              aria-pressed={rosterTab === "trainer"}
              onClick={() => setRosterTab("trainer")}
            >
              Trainer
            </button>
          </div>
          {rosterTab === "kader" ? (
            <>
              <label className="usc-search">
                Spieler suchen
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name eingeben…"
                  type="search"
                />
              </label>
              {roster.loading ? (
                <p className="usc-note" role="status">
                  Kader wird geladen…
                </p>
              ) : roster.error ? (
                <p className="usc-note" role="alert">
                  {roster.error}
                </p>
              ) : (
                <div className="usc-player-grid">
                  {players.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setPlayer(p)}
                      aria-label={`Profil von ${p.display_name} öffnen`}
                    >
                      <ProfileHeroCard
                        variant="player"
                        watermark={p.jersey_number?.toString() || ""}
                        firstNameLine={p.first_name || ""}
                        lastNameLine={p.last_name || p.display_name}
                        teamSeasonLabel={`${season.age_group} · ${season.season?.name}`}
                        teamName="USC Rohrbach"
                        teamLogoUrl={USC_LOGO}
                        photoUrl={p.avatar_url}
                        cutoutUrl={p.cutout_url}
                        initials={p.display_name.slice(0, 2)}
                        photoLayout={p.photo_layout ?? p.photo_layout_default}
                        clubTemplate={p.club_photo_template}
                        clubDesign={p.club_profile_design}
                      />
                    </button>
                  ))}
                </div>
              )}
              {!roster.loading && !roster.error && !players.length ? (
                <p className="usc-note">Keine Spieler in dieser Auswahl.</p>
              ) : null}
            </>
          ) : staff.loading ? (
            <p className="usc-note" role="status">
              Trainer werden geladen…
            </p>
          ) : staff.error ? (
            <p className="usc-note" role="alert">
              {staff.error}
            </p>
          ) : (
            <div className="usc-player-grid">
              {staff.staff.map((member) => (
                <div key={member.user_id}>
                  <ProfileHeroCard
                    variant="trainer"
                    watermark=""
                    firstNameLine={member.first_name || ""}
                    lastNameLine={member.last_name || ""}
                    teamSeasonLabel={`${season.age_group} · ${season.season?.name}`}
                    teamName="USC Rohrbach"
                    teamLogoUrl={USC_LOGO}
                    roleLabel={staffRoleLabelDe(member.role)}
                    photoUrl={member.avatar_url}
                    cutoutUrl={member.cutout_url}
                    initials={staffDisplayName(member).slice(0, 2)}
                    photoLayout={member.photo_layout}
                  />
                </div>
              ))}
              {!staff.staff.length ? (
                <p className="usc-note">
                  Noch keine Trainerprofile hinterlegt.
                </p>
              ) : null}
            </div>
          )}
        </>
      ) : null}
      {player ? (
        <PlayerProfileModal
          player={player}
          role="fan"
          teamSeasonId={season.id}
          teamSeasonLabel={`${season.age_group} · ${season.season?.name}`}
          teamName="USC Rohrbach"
          teamLogoUrl={USC_LOGO}
          photoUrl={player.avatar_url}
          canManage={false}
          onClose={() => setPlayer(null)}
          onEdit={() => {}}
          profilePlayers={roster.players}
          squadPlayers={roster.players}
          onPlayerChange={setPlayer}
        />
      ) : null}
      <dialog
        className="usc-dialog"
        ref={matchDialog}
        onCancel={closeDetail}
        onClose={closeDetail}
        aria-label="Spieldetails"
      >
        {detail ? (
          <>
            <button
              type="button"
              className="usc-dialog-close"
              aria-label="Spieldetails schließen"
              onClick={closeDetail}
            >
              <X />
            </button>
            <span className="usc-eyebrow">
              {season.age_group} · {season.season?.name}
            </span>
            <ClubMatch
              event={detail}
              score={scores.get(detail.match_id || "")}
            />
            <h2>Spielinformationen</h2>
            <p>
              {date(detail.starts_at)} · {time(detail.starts_at)} Uhr
            </p>
            <p>{detail.location || "Spielort noch offen"}</p>
            {detail.notes ? (
              <p className="usc-match-notes">{detail.notes}</p>
            ) : null}
            {detail.match_id ? (
              <UscMatchReport
                key={detail.match_id}
                matchId={detail.match_id}
                finished={scores.get(detail.match_id)?.status === "finished"}
                score={
                  scores.get(detail.match_id)?.score_home != null &&
                  scores.get(detail.match_id)?.score_away != null
                    ? `${scores.get(detail.match_id)!.score_home}:${scores.get(detail.match_id)!.score_away}`
                    : null
                }
              />
            ) : null}
            <button
              className="usc-action"
              type="button"
              onClick={() => {
                closeDetail();
                setTab("spiele");
              }}
            >
              Zurück zum Spielplan
            </button>
          </>
        ) : null}
      </dialog>
    </div>
  );
}

export function UscClubApp() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const logOut = async () => {
    setSigningOut(true);
    setAccountError(null);
    try {
      await signOut();
      setMenu(false);
      navigate(uscAuthPath("anmelden"), { replace: true });
    } catch {
      setAccountError("Abmelden ist fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setSigningOut(false);
    }
  };
  const club = useUscClub(user?.id ?? null);
  const [params, setParams] = useSearchParams();
  const clubReturnPath = `${USC_APP_PATH}${params.toString() ? `?${params.toString()}` : ""}`;
  const tab = clubTab(params.get("tab"));
  const season =
    club.seasons.find((s) => s.id === params.get("teamSeason")) ??
    club.seasons[0];
  const [menu, setMenu] = useState(false);
  const [install, setInstall] = useState(false);
  const [clubSection, setClubSection] = useState("ueber");
  const menuDialog = useRef<HTMLDialogElement>(null);
  const installDialog = useRef<HTMLDialogElement>(null);
  const setTab = (id: ClubTab) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("event");
      if (id === "home") next.delete("tab");
      else next.set("tab", id);
      return next;
    });
    setMenu(false);
  };
  useEffect(() => {
    if (menu) menuDialog.current?.showModal();
    else menuDialog.current?.close();
  }, [menu]);
  useEffect(() => {
    if (install) installDialog.current?.showModal();
    else installDialog.current?.close();
  }, [install]);
  useEffect(() => {
    document.querySelector(".usc-app")?.scrollTo({ top: 0 });
  }, [tab, season?.id]);
  const openClub = (section: string) => {
    setClubSection(section);
    setTab("verein");
  };
  return (
    <div className="usc-app">
      {isStagingApp() ? (
        <div className="usc-test-label">TESTVERSION · USC Vereinsapp</div>
      ) : null}
      <header className="usc-header">
        <Link to={USC_APP_PATH} aria-label="USC Rohrbach Startseite">
          <ClubLogo src={USC_LOGO} removeDarkBackground alt="USC Rohrbach" />
        </Link>
        <button
          className="usc-icon-button"
          type="button"
          onClick={() => setMenu(true)}
          aria-label="Vereinsmenü öffnen"
        >
          <Menu />
        </button>
      </header>
      <main>
        {authLoading ? (
          <p className="usc-note" role="status">
            Vereinsapp wird geladen…
          </p>
        ) : !user ? (
          <section className="usc-welcome">
            <span className="usc-eyebrow">USC Rohrbach</span>
            <h1>
              DEIN VEREIN.
              <br />
              IMMER DABEI.
            </h1>
            <p>
              Spiele, Ergebnisse, Mannschaften und unsere gemeinsamen Momente.
            </p>
            <Link
              className="usc-action"
              to={uscAuthPath("anmelden", clubReturnPath)}
            >
              Beim USC Rohrbach anmelden <ArrowUpRight size={18} />
            </Link>
            <button
              className="usc-install-link"
              onClick={() => setInstall(true)}
            >
              USC-Icon zum Home-Bildschirm hinzufügen
            </button>
          </section>
        ) : club.loading ? (
          <p className="usc-note" role="status">
            Mannschaften werden geladen…
          </p>
        ) : club.error ? (
          <p className="usc-note" role="alert">
            {club.error}
            <button onClick={club.retry}>Erneut laden</button>
          </p>
        ) : !season ? (
          <section className="usc-note">
            <h1>Willkommen beim USC.</h1>
            <p>
              Für dein Konto sind noch keine USC-Mannschaftsdaten sichtbar.
              Wähle den USC in SpielzeitApp als Favorit oder lass deinen Zugang
              freigeben.
            </p>
            <Link className="usc-action" to="/app/mehr">
              Zu SpielzeitApp
            </Link>
          </section>
        ) : (
          <>
            <label className="usc-team-select">
              <span>Mannschaft</span>
              <select
                value={season.id}
                onChange={(e) =>
                  setParams((previous) => {
                    const next = new URLSearchParams(previous);
                    next.set("teamSeason", e.target.value);
                    next.delete("event");
                    return next;
                  })
                }
              >
                {club.seasons.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.age_group === "KM"
                      ? "Kampfmannschaft"
                      : s.age_group === "RES"
                        ? "Reserve"
                        : s.age_group}{" "}
                    · {s.season?.name}
                  </option>
                ))}
              </select>
            </label>
            {tab !== "verein" ? (
              <ClubSeasonContent
                key={season.id}
                season={season}
                tab={tab}
                setTab={setTab}
              />
            ) : null}
          </>
        )}
        {tab === "verein" ? (
          <section className="usc-club-section">
            <span className="usc-eyebrow">USC Rohrbach</span>
            <h1>Unser Verein.</h1>
            <div className="usc-club-links">
              {[
                ["ueber", "Gemeinsam stark"],
                ["funktionaere", "Funktionäre"],
                ["sponsoren", "Sponsoren"],
                ["fanshop", "Fanshop"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={clubSection === id}
                  onClick={() => setClubSection(id)}
                >
                  {label}
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
            <div className="usc-club-copy">
              {clubSection === "ueber" ? (
                <>
                  <h2>Zu Hause in Rohrbach.</h2>
                  <p>
                    Unsere Mannschaften, unsere Menschen, unser Vereinsleben –
                    vereint in einer App.
                  </p>
                  <strong className="usc-hashtag">#GEMEINSAMSTARK</strong>
                </>
              ) : clubSection === "funktionaere" ? (
                <>
                  <h2>Menschen, die den Verein tragen.</h2>
                  <p>
                    Hier ist Platz für Vorstand und Funktionäre mit Foto und
                    Aufgabe. In den vorhandenen Daten ist noch kein
                    Funktionärsverzeichnis hinterlegt.
                  </p>
                  <button
                    className="usc-action"
                    onClick={() => setTab("teams")}
                  >
                    Mannschaften und Trainer ansehen
                  </button>
                </>
              ) : clubSection === "sponsoren" ? (
                <>
                  <h2>Starke Partner.</h2>
                  <p>
                    Kaschütz ist bereits im Vereinslogo vertreten. Eine eigene
                    Sponsorengalerie ist noch nicht hinterlegt.
                  </p>
                  <ClubLogo
                    src={USC_LOGO}
                    removeDarkBackground
                    alt="USC Kaschütz Rohrbach"
                  />
                </>
              ) : (
                <>
                  <h2>USC Fanshop.</h2>
                  <p>
                    Für diese erste Version ist noch kein Shop verknüpft. Sobald
                    der Verein einen Shop hinterlegt, kann er hier eingebunden
                    werden.
                  </p>
                </>
              )}
            </div>
          </section>
        ) : null}
        <footer className="usc-footer">
          #GEMEINSAMSTARK<small>USC Rohrbach · powered by SpielzeitApp</small>
          <Link to="/app/home">
            SpielzeitApp öffnen <ArrowUpRight size={12} />
          </Link>
        </footer>
      </main>
      <nav className="usc-bottom-nav" aria-label="Vereinsnavigation">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            onClick={() => setTab(id)}
            aria-current={
              tab === id || (tab === "tabelle" && id === "spiele")
                ? "page"
                : undefined
            }
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <dialog
        className="usc-menu usc-dialog"
        ref={menuDialog}
        onCancel={() => setMenu(false)}
        onClose={() => setMenu(false)}
        aria-label="USC Vereinsmenü"
      >
        <div className="usc-menu-header">
          <ClubLogo src={USC_LOGO} removeDarkBackground alt="USC Rohrbach" />
          <button
            className="usc-icon-button"
            onClick={() => setMenu(false)}
            aria-label="Menü schließen"
          >
            <X />
          </button>
        </div>
        <h2>Mehr beim USC</h2>
        <p>Alles rund um unseren Verein.</p>
        <div className="usc-menu-extras">
          <button onClick={() => setTab("tabelle")}>Tabelle</button>
          <button onClick={() => openClub("funktionaere")}>Funktionäre</button>
          <button onClick={() => openClub("sponsoren")}>Sponsoren</button>
          <button onClick={() => openClub("fanshop")}>Fanshop</button>
          {user ? (
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void logOut()}
            >
              {signingOut ? "Wird abgemeldet…" : "Abmelden"}
            </button>
          ) : (
            <Link to={uscAuthPath("anmelden", clubReturnPath)}>Anmelden</Link>
          )}
          {accountError ? <p role="alert">{accountError}</p> : null}
          <button
            onClick={() => {
              setMenu(false);
              setInstall(true);
            }}
          >
            App installieren
          </button>
        </div>
        <p className="usc-hashtag">#GEMEINSAMSTARK</p>
      </dialog>
      <dialog
        className="usc-dialog usc-install"
        ref={installDialog}
        onCancel={() => setInstall(false)}
        onClose={() => setInstall(false)}
        aria-label="USC-App installieren"
      >
        <button
          className="usc-dialog-close"
          onClick={() => setInstall(false)}
          aria-label="Installationshilfe schließen"
        >
          <X />
        </button>
        <img
          src={USC_APP_ICON}
          width="96"
          height="96"
          alt="USC-App-Icon auf silbergrauem Hintergrund"
        />
        <h2>Dein USC. Ein Fingertipp.</h2>
        <p>
          Öffne diese Vereinsseite in Safari und füge sie zum Home-Bildschirm
          hinzu.
        </p>
        <ol>
          <li>
            Unten auf <strong>Teilen</strong> tippen.
          </li>
          <li>
            <strong>Zum Home-Bildschirm</strong> auswählen.
          </li>
          <li>
            Den Namen <strong>USC Rohrbach</strong> bestätigen und{" "}
            <strong>Hinzufügen</strong> tippen.
          </li>
        </ol>
        <p className="usc-note">
          Android: Browsermenü → App installieren / Zum Startbildschirm
          hinzufügen.
        </p>
        <a
          href="/clubs/usc-rohrbach/icon-512.png"
          download="USC-Rohrbach-Icon.png"
        >
          Icon herunterladen
        </a>
      </dialog>
    </div>
  );
}
