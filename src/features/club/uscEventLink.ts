import { USC_APP_PATH } from "./uscClub";
import type { EventRow } from "../../hooks/useEvents";
/** Only redirect games already loaded in this authorized club-season scope. */
export function uscEventLink(
  href: string,
  events: EventRow[],
  seasonId: string,
): string | null {
  try {
    const url = new URL(href, "https://club.invalid");
    if (url.origin !== "https://club.invalid") return null;
    const eventId = /^\/app\/events\/([^/]+)$/.exec(url.pathname)?.[1];
    const matchId =
      /^\/app\/(?:live|match)\/([^/]+)$/.exec(url.pathname)?.[1] ??
      (["/app/live", "/app/match-preparation"].includes(url.pathname)
        ? url.searchParams.get("matchId")
        : null);
    const event = events.find(
      (e) =>
        e.team_season_id === seasonId &&
        ((eventId && e.id === decodeURIComponent(eventId)) ||
          (matchId && e.match_id === decodeURIComponent(matchId))),
    );
    if (!event) return null;
    return `${USC_APP_PATH}?${new URLSearchParams({ tab: "spiele", teamSeason: seasonId, event: event.id })}`;
  } catch {
    return null;
  }
}
