export const USC_APP_PATH = "/app/usc-rohrbach";
export const USC_CLUB_ID = "3db6fce2-a4c1-44a5-a333-19d1d4d62e6a";
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
export function sortClubSeasons(rows: ClubSeason[]): ClubSeason[] {
  return rows
    .filter(
      (row) => row.team?.club_id === USC_CLUB_ID && row.status === "active",
    )
    .sort(
      (a, b) =>
        Number(b.age_group === "KM") - Number(a.age_group === "KM") ||
        (b.season?.name ?? "").localeCompare(a.season?.name ?? "") ||
        (a.age_group ?? "").localeCompare(b.age_group ?? ""),
    );
}
