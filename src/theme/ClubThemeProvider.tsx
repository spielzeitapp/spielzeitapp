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

export const ClubBrandingOverrideContext = React.createContext<ClubBranding | undefined>(undefined);

export const ClubThemeProvider: React.FC<React.PropsWithChildren<{ brandingOverride?: ClubBranding }>> = ({ children, brandingOverride }) => {
  const location = useLocation();
  const { selectedTeamSeasonId, viewTeamSeasonId, teamViewFilter, filteredTeamSeasonIds } = useSession();
  // A combined view can contain different clubs: never color it using only the
  // previously selected club. Single-team views use that team's actual branding.
  const overview = ['/app', '/app/home', '/app/termine', '/app/tabelle'].includes(location.pathname);
  const combinedView = overview && teamViewFilter !== null && filteredTeamSeasonIds.length > 1;
  // The explicit read scope is authoritative even before its metadata loads.
  const singleFilterId = Array.isArray(teamViewFilter) && teamViewFilter.length === 1 ? teamViewFilter[0] : null;
  const requestedId = location.pathname === '/app/team' ? new URLSearchParams(location.search).get('teamSeason') : null;
  const routeTeamId = requestedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId) ? requestedId : null;
  const teamSeasonId = combinedView ? null : routeTeamId ?? singleFilterId ?? viewTeamSeasonId ?? selectedTeamSeasonId;
  const isDemo = location.pathname.startsWith('/demo');
  const [loaded, setLoaded] = useState<{ teamSeasonId: string; branding: ClubBranding | null } | null>(null);
  // Do not show the previous club's colors while the next club is loading.
  const storedBranding = brandingOverride ?? (!combinedView && !isDemo && loaded?.teamSeasonId === teamSeasonId
    ? loaded.branding : null);

  useEffect(() => {
    let cancelled = false;
    if (brandingOverride || !teamSeasonId || combinedView || isDemo) {
      return () => { cancelled = true; };
    }
    void getClubBrandingForTeamSeason(teamSeasonId).then((result) => {
      if (cancelled) return;
      if (result.error) console.warn('[ClubThemeProvider] branding could not be loaded:', result.error);
      setLoaded({ teamSeasonId, branding: result.data });
    });
    return () => { cancelled = true; };
  }, [isDemo, teamSeasonId, combinedView, brandingOverride]);

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
    // Select the kit artwork from the palette, independent of club names or IDs.
    const [pr, pg, pb] = palette.primary.split(' ').map(Number);
    const [ar, ag, ab] = palette.accent.split(' ').map(Number);
    const bluePrimary = pb > pr * 1.3 && pb > pg * 1.1;
    const yellowAccent = ar > 150 && ag > 100 && ab < 100;
    root.dataset.clubWelcomeKit = bluePrimary && yellowAccent ? 'blue-yellow' : 'default';
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
    <ClubBrandingOverrideContext.Provider value={brandingOverride}>
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
    </ClubBrandingOverrideContext.Provider>
  );
};
