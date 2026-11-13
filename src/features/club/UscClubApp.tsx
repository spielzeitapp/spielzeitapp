import { UscClubStart, USC_START_PHOTO } from "./UscClubStart";
import { UscFanshop } from "./UscFanshop";
import { UscClubLive } from "./UscClubLive";
import { useUscLiveMatches } from "./uscLive";
import { UscMainTeamFilter, useUscTeamSelection } from "./UscMainTeamFilter";
import { UscTeamPicker } from "./UscTeamPicker";
import { useMatchClubBranding } from "../../hooks/useMatchClubBranding";
import { UscClubNewsHome } from "./UscClubNewsHome";
import { MatchCardGameCore } from "../../components/match/MatchCardGameCore";
import { TeamHeroFrame } from "../../components/team/TeamHeroFrame";
import { TeamSquadShowcase } from "../../components/team/TeamSquadShowcase";
import { TeamTrainerShowcase } from "../../components/team/TeamTrainerShowcase";
import { PastMatchResultCard } from "../../components/schedule/PastMatchResultCard";
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
  ChevronRight,
  Menu,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { useEvents, type EventRow } from "../../hooks/useEvents";
import { usePlayers, type PlayerItem } from "../../hooks/usePlayers";
import {
  useTeamStaff,
  type TeamStaffMember,
  staffDisplayName,
  staffRoleLabelDe,
} from "../../hooks/useTeamStaff";
import { supabase } from "../../lib/supabaseClient";
import { ClubLogo } from "../../components/branding/ClubLogo";
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
  USC_CLUB_ID,
  clubSeasonTeamName,
  USC_LOGO,
  USC_APP_ICON,
  clubTab,
  type ClubTab,
  type ClubSeason,
} from "./uscClub";
import { useUscClub } from "./useUscClub";
import "./uscClubApp.css";
const ClubExchange = React.lazy(() => import('./ClubExchange').then(m => ({ default: m.ClubExchange })));

const NO_OWN_PLAYERS = new Set<string>();

const tabs = [
  { id: "home", label: "Home", iconFile: "home-ball.png" },
  { id: "spiele", label: "Spiele", iconFile: "pitch.svg" },
  { id: "teams", label: "Teams", iconFile: "team.svg" },
  { id: "live", label: "Live", iconFile: "live.svg" },
  { id: "verein", label: "Verein", iconFile: "more.svg" },
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
  teamName = "USC Rohrbach",
  teamLogo = USC_LOGO,
}: {
  event: EventRow;
  score?: Score;
  onOpen?: () => void;
  hero?: boolean;
  teamName?: string;
  teamLogo?: string;
}) {
  const finished =
    score?.status === "finished" &&
    score.score_home != null &&
    score.score_away != null;
  const own = { name: teamName, logo: teamLogo };
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
      <div className="usc-shared-game">
        <MatchCardGameCore headerTitle={null} leftName={sides[0].name} rightName={sides[1].name} leftLogoUrl={sides[0].logo} opponentLogoUrl={sides[1].logo} timeDisplay={time(event.starts_at)} isMatch showScore={finished} homeScore={score?.score_home ?? 0} awayScore={score?.score_away ?? 0} kickoffLocation={null} meetupTimeOnly="" showMeetupPill={false} compactScheduleHero suppressCompactScheduleFooter kickoffHeaderLabel={finished ? "Endstand" : "Anpfiff"} />
      </div>
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
  const { brand, style: teamStyle } = useMatchClubBranding(season.id);
  const teamName = clubSeasonTeamName(season);
  const teamLogo = brand?.logo_url || (season.team.club_id === USC_CLUB_ID ? USC_LOGO : getClubLogo(teamName));

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
          next.delete("liveMatch");
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
  const roster = usePlayers(tab === "teams" ? season.id : null);
  const staff = useTeamStaff(tab === "teams" ? season.id : null);
  const [player, setPlayer] = useState<PlayerItem | null>(null);
  const [trainer, setTrainer] = useState<TeamStaffMember | null>(null);
  const [trainerIndex, setTrainerIndex] = useState(0);
  const trainerDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (trainer) trainerDialog.current?.showModal();
    else trainerDialog.current?.close();
  }, [trainer]);
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
  const activePlayers = useMemo(() => roster.players
    .filter((p) => (p.status ?? "active") === "active")
    .sort((a, b) => (a.jersey_number ?? 9999) - (b.jersey_number ?? 9999) || a.display_name.localeCompare(b.display_name, "de")), [roster.players]);
  const players = activePlayers;
  return (
    <div className="usc-season-content" style={teamStyle} onClickCapture={keepClubNavigation}>
      {tab === "spiele" ? (
        <>
          <div className="usc-page-title">
            <span className="usc-eyebrow">
              {season.age_group} · {season.season?.name}
            </span>
            <div className="usc-title-actions"><h1>Spielplan</h1><button onClick={() => setTab("tabelle")}>Zur Tabelle <ChevronRight size={16} /></button></div>
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
              {visibleMatches.map((event) => {
                const score = scores.get(event.match_id || "");
                return score?.status === "finished" && score.score_home != null && score.score_away != null ? (
                  <PastMatchResultCard key={event.id} ev={event} ageGroup={season.age_group} ourTeamName={teamName} opponentLogoUrl={event.opponent_logo_url} scoreHome={score.score_home} scoreAway={score.score_away} forcePublicView={false} compact onNavigate={() => openDetail(event)} />
                ) : <ClubMatch key={event.id} event={event} score={score} teamName={teamName} teamLogo={teamLogo} onOpen={() => openDetail(event)} />;
              })}
              {!visibleMatches.length ? (
                <p className="usc-note">Keine Spiele in dieser Auswahl.</p>
              ) : null}
            </div>
          )}
        </>
      ) : null}
      {scoreError && tab === "spiele" ? (
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
            <div className="usc-title-actions"><h1>Tabelle</h1><button onClick={() => setTab("spiele")}>Zum Spielplan <ChevronRight size={16} /></button></div>
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
          <TeamHeroFrame className="usc-team-hero" photoSrc={photo?.photo_url} photoStyle={photo ? teamPhotoImageStyle(photo) : undefined}>
            <div className="flex items-end gap-3">
              <ClubLogo src={teamLogo} removeDarkBackground alt={teamName} className="h-14 w-24 shrink-0 object-contain" />
              <div className="min-w-0 pb-1">
                <h1 className="text-2xl font-black uppercase leading-tight tracking-tight">{teamName}</h1>
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-white/75">{season.age_group} · Saison {season.season?.name}</p>
              </div>
            </div>
          </TeamHeroFrame>
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
            <button onClick={() => setTab("spiele")}>Spiele</button>
          </div>
          {rosterTab === "kader" ? (
            <>
              <div className="usc-roster-heading"><h2>Unser Team</h2><span>{activePlayers.length} Spieler</span></div>
              {roster.loading ? (
                <p className="usc-note" role="status">
                  Kader wird geladen…
                </p>
              ) : roster.error ? (
                <p className="usc-note" role="alert">
                  {roster.error}
                </p>
              ) : (
                <TeamSquadShowcase
                  teamName={teamName}
                  teamSeasonLabel={`${season.age_group} · ${season.season?.name}`}
                  teamLogoUrl={teamLogo}
                  players={players}
                  ownPlayerIds={NO_OWN_PLAYERS}
                  onPlayerClick={setPlayer}
                  trainerCount={staff.staff.length}
                  onSwipePastEnd={() => { setTrainerIndex(0); setRosterTab("trainer"); }}
                  onTrainerSelect={(index) => { setTrainerIndex(index); setRosterTab("trainer"); }}
                />
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
            <>
              <div className="usc-roster-heading"><h2>Unsere Trainer</h2><span>{staff.staff.length} Trainer</span></div>
              <TeamTrainerShowcase trainers={staff.staff} onTrainerClick={setTrainer} initialIndex={trainerIndex} onSwipePastStart={() => setRosterTab("kader")} />
              {!staff.staff.length ? <p className="usc-note">Noch keine Trainerprofile hinterlegt.</p> : null}
            </>
          )}
        </>
      ) : null}
      {player ? (
        <PlayerProfileModal
          player={player}
          role="fan"
          teamSeasonId={season.id}
          teamSeasonLabel={`${season.age_group} · ${season.season?.name}`}
          teamName={teamName}
          teamLogoUrl={teamLogo}
          photoUrl={player.avatar_url}
          canManage={false}
          onClose={() => setPlayer(null)}
          onEdit={() => {}}
          profilePlayers={activePlayers}
          squadPlayers={activePlayers}
          onPlayerChange={setPlayer}
        />
      ) : null}
      <dialog className="usc-dialog" ref={trainerDialog} onCancel={() => setTrainer(null)} onClose={() => setTrainer(null)} aria-label="Trainerprofil">
        <button className="usc-dialog-close" aria-label="Trainerprofil schließen" onClick={() => setTrainer(null)}><X /></button>
        {trainer ? <>
          <ProfileHeroCard variant="trainer" watermark="" firstNameLine={trainer.first_name || ""} lastNameLine={trainer.last_name || ""} teamSeasonLabel={`${season.age_group} · ${season.season?.name}`} teamName={teamName} teamLogoUrl={teamLogo} roleLabel={staffRoleLabelDe(trainer.role)} photoUrl={trainer.avatar_url} cutoutUrl={trainer.cutout_url} initials={staffDisplayName(trainer).slice(0, 2)} photoLayout={trainer.photo_layout} />
          <h2>{staffDisplayName(trainer)}</h2><p>{staffRoleLabelDe(trainer.role)}</p>
        </> : null}
      </dialog>
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
              teamName={teamName}
              teamLogo={teamLogo}
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
  const myTeams = useUscTeamSelection(user?.id ?? null, club.seasons);
  const live = useUscLiveMatches(user?.id ?? null, myTeams.seasons);
  const [teamFilterOpen, setTeamFilterOpen] = useState(false);
  useEffect(() => { setTeamFilterOpen(false); }, [user?.id]);
  const [params, setParams] = useSearchParams();
  const clubReturnPath = `${USC_APP_PATH}${params.toString() ? `?${params.toString()}` : ""}`;
  const tab = clubTab(params.get("tab"));
  const season =
    myTeams.seasons.find((s) => s.id === params.get("teamSeason")) ??
    myTeams.seasons[0];
  const [menu, setMenu] = useState(false);
  const [install, setInstall] = useState(false);
  const clubSection = params.get("section") || "ueber";
  const menuDialog = useRef<HTMLDialogElement>(null);
  const installDialog = useRef<HTMLDialogElement>(null);
  const setTab = (id: ClubTab) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("event");
      next.delete("liveMatch");
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
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("tab", "verein"); next.set("section", section);
      next.delete("event"); next.delete("liveMatch"); next.delete("thread");
      return next;
    });
    setMenu(false);
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
        {user && club.seasons.length > 0 ? <button type="button" className={`usc-icon-button usc-news-filter-button ${myTeams.allSelected ? "" : "usc-news-filter-active"}`} aria-label="Meine Mannschaften" aria-haspopup="dialog" aria-expanded={teamFilterOpen} onClick={() => setTeamFilterOpen(true)}><SlidersHorizontal size={21} />{!myTeams.allSelected ? <span>{myTeams.visibleIds.length}</span> : null}</button> : null}
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
          <section className="usc-welcome usc-welcome-photo" style={{ backgroundImage: `linear-gradient(180deg, #10121418, #101214bb 48%, #101214 100%), url(${USC_START_PHOTO})` }}>
            <span className="usc-eyebrow">#GEMEINSAMSTARK</span>
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
        ) : !club.seasons.length ? (
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
            {tab !== "verein" && tab !== "home" && tab !== "live" && season ? <UscTeamPicker seasons={myTeams.seasons} selectedId={season.id} onSelect={(id) => {
              if (!myTeams.seasons.some((item) => item.id === id)) return;
              setParams((previous) => { const next = new URLSearchParams(previous); next.set("teamSeason", id); next.delete("event"); return next; });
            }} /> : null}
            {tab === "live" ? <UscClubLive key={`${user.id}:${myTeams.visibleIds.join(",")}`} seasons={myTeams.seasons} live={live} onOpenTeamFilter={() => setTeamFilterOpen(true)} /> : null}
            {tab === "home" ? <UscClubNewsHome key={`${user.id}:${myTeams.visibleIds.join(",")}`} seasons={myTeams.seasons} allSelected={myTeams.allSelected} onOpenTeamFilter={() => setTeamFilterOpen(true)} /> : null}
            {tab !== "verein" && tab !== "home" && tab !== "live" && !season ? <section className="usc-news-empty"><h2>Keine Mannschaft ausgewählt</h2><p>Wähle unter „Meine Mannschaften“, welche Teams du hier sehen möchtest.</p><button className="usc-action" onClick={() => setTeamFilterOpen(true)}>Mannschaften auswählen</button></section> : null}
            {tab !== "verein" && tab !== "home" && tab !== "live" && season ? (
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
          clubSection === "fanshop" ? <UscFanshop onBack={() => openClub("ueber")} /> :
          <section className="usc-club-section">
            {clubSection !== 'tauschboerse' ? <><span className="usc-eyebrow">USC Rohrbach</span>
            <h1>Unser Verein.</h1>
            <div className="usc-club-links">
              {[
                ["ueber", "Gemeinsam stark"],
                ["funktionaere", "Funktionäre"],
                ["sponsoren", "Sponsoren"],
                ["fanshop", "Fanshop"],
                ...(isStagingApp() ? [["tauschboerse", "Tauschbörse"]] : []),
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={clubSection === id}
                  onClick={() => openClub(id)}
                >
                  {label}
                  <ChevronRight size={18} />
                </button>
              ))}
            </div></> : <button className="usc-install-link" onClick={() => openClub('ueber')}>← Zum Vereinsmenü</button>}
            {clubSection === 'tauschboerse' && isStagingApp() ? (user ? <React.Suspense fallback={<p role="status">Tauschbörse wird geladen…</p>}><ClubExchange key={user.id} clubId={USC_CLUB_ID} userId={user.id} seasons={club.seasons} /></React.Suspense> : <p className="usc-note">Bitte melde dich an, um die vereinsinterne Tauschbörse zu öffnen.</p>) : <div className="usc-club-copy">
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
            </div>}
          </section>
        ) : null}
        <footer className="usc-footer">
          #GEMEINSAMSTARK<small>USC Rohrbach · powered by SpielzeitApp</small>
          <Link to="/app/home">
            SpielzeitApp öffnen <ArrowUpRight size={12} />
          </Link>
        </footer>
      </main>
      {user && club.seasons.length > 0 ? <UscMainTeamFilter key={user.id} open={teamFilterOpen} scopes={myTeams.scopes} visibleIds={myTeams.visibleIds} onClose={() => setTeamFilterOpen(false)} onApply={(ids) => {
        myTeams.save(ids);
        if (params.get("liveMatch") || !ids.includes(params.get("teamSeason") ?? "")) setParams((previous) => {
          const next = new URLSearchParams(previous);
          const first = myTeams.scopes.find((item) => ids.includes(item.id));
          if (first) next.set("teamSeason", first.id); else next.delete("teamSeason");
          next.delete("event");
          next.delete("liveMatch");
          return next;
        });
      }} /> : null}
      {user ? <nav className="usc-bottom-nav" aria-label="Vereinsnavigation">
        {tabs.map(({ id, label, iconFile }) => (
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
            <img src={`${import.meta.env.BASE_URL || "/"}icons/${iconFile}`} alt="" className={`usc-nav-icon ${id === "home" ? "usc-nav-icon-ball" : ""}`} decoding="async" draggable={false} />
            <span>{label}</span>
            {id === "live" && live.rows.length > 0 ? <span className="usc-nav-live-count" aria-label={`${live.rows.length} laufende Spiele`}>{live.rows.length}</span> : null}
          </button>
        ))}
      </nav> : null}
      <UscClubStart enabled={!params.get("tab") && !params.get("event")} ready={!authLoading && (!user || !club.loading)} />
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
          {isStagingApp() && user ? <button onClick={() => openClub("tauschboerse")}>Tauschbörse</button> : null}
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
