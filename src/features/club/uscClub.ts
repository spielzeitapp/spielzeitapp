export const USC_APP_PATH = "/app/usc-rohrbach";
export const USC_CLUB_ID = "3db6fce2-a4c1-44a5-a333-19d1d4d62e6a";
// Existing Spielgemeinschaft teams also belong in the USC club app.
// This is presentation scope only; Supabase RLS still controls every read.
export const USC_PARTNER_TEAMS = [{ clubId: "9c7a8741-6e73-42d5-88d8-46ce5217e8cd", teamName: "SPG Rohrbach" }] as const;
export const USC_LOGO =
  "https://acbaecjzoabafbsjrzvr.supabase.co/storage/v1/object/public/club-logos/3db6fce2-a4c1-44a5-a333-19d1d4d62e6a/33acd6ee-22b0-4a16-ac0a-665727a32688.png";
export const USC_MANIFEST = "/clubs/usc-rohrbach/manifest.json";
export const USC_APP_ICON = "/clubs/usc-rohrbach/icon-180.png";
export function isUscAppPath(path: string): boolean {
  return path === USC_APP_PATH || path.startsWith(USC_APP_PATH + "/");
}
export type ClubTab = "home" | "spiele" | "teams" | "verein" | "tabelle";
export function clubTab(raw: string | null): ClubTab {
  return raw === "spiele" ||
    raw === "teams" ||
    raw === "verein" ||
    raw === "tabelle"
    ? raw
    : "home";
}
export type ClubSeason = {
  id: string;
  team_id: string;
  age_group: string | null;
  display_name: string | null;
  status: string;
  team: { name: string; club_id: string };
  season: { name: string };
};
export function isUscClubSeason(row: ClubSeason): boolean {
  return row.team?.club_id === USC_CLUB_ID || USC_PARTNER_TEAMS.some((partner) => row.team?.club_id === partner.clubId && row.team.name === partner.teamName);
}
export function clubSeasonTeamName(row: ClubSeason): string {
  return row.team?.club_id === USC_CLUB_ID ? "USC Rohrbach" : row.team.name;
}
export function sortClubSeasons(rows: ClubSeason[]): ClubSeason[] {
  return rows
    .filter(
      (row) => isUscClubSeason(row) && row.status === "active",
    )
    .sort(
      (a, b) =>
        Number(b.age_group === "KM") - Number(a.age_group === "KM") ||
        Number(b.age_group === "RES") - Number(a.age_group === "RES") ||
        (b.season?.name ?? "").localeCompare(a.season?.name ?? "") ||
        (b.age_group ?? "").localeCompare(a.age_group ?? "", "de", { numeric: true }),
    );
}
