import React, { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../auth/useSession";

export type ClubThemeKey = "black-red" | "blue-yellow" | "green-white" | "black-white";

type ClubPalette = {
  primary: string;
  accent: string;
  secondary: string;
  onPrimary: string;
};

const CLUB_PALETTES: Record<ClubThemeKey, ClubPalette> = {
  "black-red": {
    primary: "122 29 42",
    accent: "255 64 80",
    secondary: "255 255 255",
    onPrimary: "#ffffff",
  },
  "blue-yellow": {
    primary: "22 87 168",
    accent: "250 204 21",
    secondary: "255 255 255",
    onPrimary: "#ffffff",
  },
  "green-white": {
    primary: "22 130 74",
    accent: "236 253 245",
    secondary: "255 255 255",
    onPrimary: "#ffffff",
  },
  "black-white": {
    primary: "82 82 91",
    accent: "244 244 245",
    secondary: "255 255 255",
    onPrimary: "#ffffff",
  },
};

function isClubThemeKey(value: string | null): value is ClubThemeKey {
  return value === "black-red" || value === "blue-yellow" || value === "green-white" || value === "black-white";
}

/**
 * Test-Override: `?clubTheme=blue-yellow|green-white|black-white|black-red`.
 * Bekannte Mannschaften erhalten ansonsten automatisch ihr Farbpaar.
 */
export function resolveClubThemeKey(teamName: string, search: string): ClubThemeKey {
  const params = new URLSearchParams(search);
  const requested = params.get("clubTheme");
  if (isClubThemeKey(requested)) return requested;

  const normalized = `${teamName} ${params.get("club") ?? ""}`.trim().toLocaleLowerCase("de-AT");
  if (/melk|blau.?gelb/.test(normalized)) return "blue-yellow";
  if (/grün.?weiß|gruen.?weiss/.test(normalized)) return "green-white";
  if (/usc\s+.*rohrbach|schwarz.?weiß|schwarz.?weiss/.test(normalized)) return "black-white";
  return "black-red";
}

export const ClubThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const location = useLocation();
  const { selectedTeamSeason, viewTeamSeason } = useSession();
  const teamName = (viewTeamSeason ?? selectedTeamSeason)?.team?.name ?? "";
  const themeKey = useMemo(
    () => resolveClubThemeKey(teamName, location.search),
    [location.search, teamName],
  );

  useEffect(() => {
    const root = document.documentElement;
    const palette = CLUB_PALETTES[themeKey];
    root.dataset.clubTheme = themeKey;
    root.style.setProperty("--club-primary-rgb", palette.primary);
    root.style.setProperty("--club-accent-rgb", palette.accent);
    root.style.setProperty("--club-secondary-rgb", palette.secondary);
    root.style.setProperty("--club-on-primary", palette.onPrimary);
  }, [themeKey]);

  return <>{children}</>;
};
