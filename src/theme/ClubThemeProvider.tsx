import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../auth/useSession";
import {
  getClubBrandingForTeamSeason,
  hexToRgbChannels,
  readableTextColor,
  type ClubBranding,
} from "../lib/clubBranding";

export type ClubThemeKey = "black-red" | "blue-yellow" | "green-white" | "black-white";

type ClubPalette = {
  primary: string;
  accent: string;
  border: string;
  secondary: string;
  onPrimary: string;
  onAccent: string;
};

const CLUB_PALETTES: Record<ClubThemeKey, ClubPalette> = {
  "black-red": {
    primary: "122 29 42",
    accent: "255 64 80",
    border: "255 64 80",
    secondary: "255 255 255",
    onPrimary: "#ffffff",
    onAccent: "#ffffff",
  },
  "blue-yellow": {
    primary: "22 87 168",
    accent: "250 204 21",
    border: "37 125 255",
    secondary: "255 255 255",
    onPrimary: "#ffffff",
    onAccent: "#111114",
  },
  "green-white": {
    primary: "22 130 74",
    accent: "236 253 245",
    border: "34 197 94",
    secondary: "255 255 255",
    onPrimary: "#ffffff",
    onAccent: "#111114",
  },
  "black-white": {
    primary: "82 82 91",
    accent: "244 244 245",
    border: "212 212 216",
    secondary: "255 255 255",
    onPrimary: "#ffffff",
    onAccent: "#111114",
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
  const activeTeamSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamName = activeTeamSeason?.team?.name ?? "";
  const teamSeasonId = activeTeamSeason?.id ?? null;
  const [storedBranding, setStoredBranding] = useState<ClubBranding | null>(null);
  const themeKey = useMemo(
    () => resolveClubThemeKey(teamName, location.search),
    [location.search, teamName],
  );

  useEffect(() => {
    let cancelled = false;
    setStoredBranding(null);
    if (!teamSeasonId || location.pathname.startsWith('/demo') || location.search.includes("clubTheme=")) {
      return () => { cancelled = true; };
    }
    void getClubBrandingForTeamSeason(teamSeasonId).then((result) => {
      if (cancelled) return;
      if (result.error) console.warn('[ClubThemeProvider] branding could not be loaded:', result.error);
      setStoredBranding(result.data);
    });
    return () => { cancelled = true; };
  }, [location.pathname, location.search, teamSeasonId]);

  useEffect(() => {
    const root = document.documentElement;
    const fallback = CLUB_PALETTES[themeKey];
    const primaryHex = storedBranding?.primary_color;
    const accentHex = storedBranding?.accent_color;
    const secondaryHex = storedBranding?.secondary_color;
    const palette: ClubPalette = primaryHex || accentHex || secondaryHex
      ? {
          primary: hexToRgbChannels(primaryHex ?? '#7A1D2A'),
          accent: hexToRgbChannels(accentHex ?? primaryHex ?? '#FF4050'),
          border: hexToRgbChannels(accentHex ?? primaryHex ?? '#FF4050'),
          secondary: hexToRgbChannels(secondaryHex ?? '#FFFFFF'),
          onPrimary: readableTextColor(primaryHex ?? '#7A1D2A'),
          onAccent: readableTextColor(accentHex ?? primaryHex ?? '#FF4050'),
        }
      : fallback;
    root.dataset.clubTheme = storedBranding ? 'custom' : themeKey;
    root.style.setProperty("--club-primary-rgb", palette.primary);
    root.style.setProperty("--club-accent-rgb", palette.accent);
    root.style.setProperty("--club-border-rgb", palette.border);
    root.style.setProperty("--club-secondary-rgb", palette.secondary);
    root.style.setProperty("--club-on-primary", palette.onPrimary);
    root.style.setProperty("--club-on-accent", palette.onAccent);
  }, [storedBranding, themeKey]);

  return (
    <>
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden focusable="false">
        <defs>
          <filter id="sz-jersey-blue" colorInterpolationFilters="sRGB">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1.8 -0.9 -0.9 0 -0.22"
              result="redMask"
            />
            <feComponentTransfer in="redMask" result="selectedRed">
              <feFuncA type="discrete" tableValues="0 0 0 1 1" />
            </feComponentTransfer>
            <feFlood floodColor="#176fe5" floodOpacity="0.88" result="clubColor" />
            <feComposite in="clubColor" in2="selectedRed" operator="in" result="tintedRed" />
            <feComposite in="tintedRed" in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="sz-jersey-green" colorInterpolationFilters="sRGB">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1.8 -0.9 -0.9 0 -0.22"
              result="redMask"
            />
            <feComponentTransfer in="redMask" result="selectedRed">
              <feFuncA type="discrete" tableValues="0 0 0 1 1" />
            </feComponentTransfer>
            <feFlood floodColor="#18a558" floodOpacity="0.9" result="clubColor" />
            <feComposite in="clubColor" in2="selectedRed" operator="in" result="tintedRed" />
            <feComposite in="tintedRed" in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="sz-jersey-white" colorInterpolationFilters="sRGB">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1.8 -0.9 -0.9 0 -0.22"
              result="redMask"
            />
            <feComponentTransfer in="redMask" result="selectedRed">
              <feFuncA type="discrete" tableValues="0 0 0 1 1" />
            </feComponentTransfer>
            <feFlood floodColor="#f4f4f5" floodOpacity="0.82" result="clubColor" />
            <feComposite in="clubColor" in2="selectedRed" operator="in" result="tintedRed" />
            <feComposite in="tintedRed" in2="SourceGraphic" operator="over" />
          </filter>
        </defs>
      </svg>
      {children}
    </>
  );
};
