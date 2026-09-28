import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../auth/useSession";
import {
  getClubBrandingForTeamSeason,
  hexToRgbChannels,
  readableAccentOnDark,
  readableTextColor,
  type ClubBranding,
} from "../lib/clubBranding";

type ClubPalette = {
  primary: string;
  accent: string;
  border: string;
  secondary: string;
  onPrimary: string;
  onAccent: string;
};

const DEFAULT_PALETTE: ClubPalette = {
    primary: "122 29 42",
    accent: "255 64 80",
    border: "255 64 80",
    secondary: "255 255 255",
    onPrimary: "#ffffff",
    onAccent: "#ffffff",
};

export const ClubThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const location = useLocation();
  const { selectedTeamSeason, viewTeamSeason } = useSession();
  const activeTeamSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = activeTeamSeason?.id ?? null;
  const [loaded, setLoaded] = useState<{ teamSeasonId: string; branding: ClubBranding | null } | null>(null);
  // Do not show the previous club's colors while the next club is loading.
  const storedBranding = !location.pathname.startsWith('/demo') && loaded?.teamSeasonId === teamSeasonId
    ? loaded.branding : null;

  useEffect(() => {
    let cancelled = false;
    if (!teamSeasonId || location.pathname.startsWith('/demo')) {
      return () => { cancelled = true; };
    }
    void getClubBrandingForTeamSeason(teamSeasonId).then((result) => {
      if (cancelled) return;
      if (result.error) console.warn('[ClubThemeProvider] branding could not be loaded:', result.error);
      setLoaded({ teamSeasonId, branding: result.data });
    });
    return () => { cancelled = true; };
  }, [location.pathname, teamSeasonId]);

  useEffect(() => {
    const root = document.documentElement;
    const fallback = DEFAULT_PALETTE;
    const primaryHex = storedBranding?.primary_color;
    const accentHex = storedBranding?.accent_color;
    const secondaryHex = storedBranding?.secondary_color;
    const palette: ClubPalette = primaryHex || accentHex || secondaryHex
      ? {
          primary: primaryHex ? hexToRgbChannels(primaryHex) : fallback.primary,
          accent: accentHex ? hexToRgbChannels(accentHex) : fallback.accent,
          border: accentHex ? hexToRgbChannels(accentHex) : fallback.border,
          secondary: hexToRgbChannels(secondaryHex ?? '#FFFFFF'),
          onPrimary: primaryHex ? readableTextColor(primaryHex) : fallback.onPrimary,
          onAccent: accentHex ? readableTextColor(accentHex) : fallback.onAccent,
        }
      : fallback;
    root.dataset.clubTheme = primaryHex || accentHex || secondaryHex ? 'custom' : 'black-red';
    root.style.setProperty("--club-primary-rgb", palette.primary);
    root.style.setProperty("--club-accent-rgb", palette.accent);
    root.style.setProperty("--club-border-rgb", palette.border);
    root.style.setProperty("--club-secondary-rgb", palette.secondary);
    root.style.setProperty("--club-on-primary", palette.onPrimary);
    root.style.setProperty("--club-on-accent", palette.onAccent);
    root.style.setProperty("--club-accent-text-rgb", readableAccentOnDark(accentHex ?? '#FF4050'));
  }, [storedBranding]);

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
