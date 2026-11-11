import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CalendarPlus, MapPin, Share2, ExternalLink } from "lucide-react";
import { TournamentCollapsibleSection } from "./TournamentCollapsibleSection";
import {
  publicTeamTournamentPath,
  sharePublicTeamTournamentPage,
} from "../../lib/publicTeamTournament";

const actionClass =
  "sz-club-event-action inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full border px-4 py-3 text-[16px] font-bold text-white touch-manipulation";
export function TournamentQuickActionBar({
  shareTitle,
  tournamentEventId,
  onAddToCalendar,
  onNavigate,
  showNavigation = false,
  location: venue,
}: {
  shareTitle: string;
  tournamentEventId: string;
  onAddToCalendar: () => void;
  onNavigate?: () => void;
  showNavigation?: boolean;
  location?: string | null;
}) {
  const location = useLocation();
  const [hint, setHint] = useState<string | null>(null);
  const share = async () => {
    const result = await sharePublicTeamTournamentPage(
      shareTitle,
      tournamentEventId,
    );
    setHint(
      result === "shared"
        ? "Turnierseite geteilt"
        : result === "copied"
          ? "Turnierseite-Link kopiert"
          : "Teilen nicht verfügbar",
    );
    window.setTimeout(() => setHint(null), 2200);
  };
  return (
    <div className="space-y-3">
      <TournamentCollapsibleSection title="Turnierdetails" icon={<MapPin />}>
        <div className="space-y-4">
          <div>
            <p className="text-[16px] font-bold text-white">Spielort</p>
            <p className="mt-1 whitespace-pre-line text-[16px] leading-relaxed text-white/75">
              {venue?.trim() || "Spielort noch offen"}
            </p>
          </div>
          <div
            className={`grid gap-2 ${showNavigation && onNavigate ? "grid-cols-2" : "grid-cols-1"}`}
            role="toolbar"
            aria-label="Turnieraktionen"
          >
            <button
              type="button"
              onClick={onAddToCalendar}
              className={actionClass}
            >
              <CalendarPlus
                aria-hidden
                className="h-5 w-5 shrink-0 sz-club-accent-text"
              />
              Kalender
            </button>
            {showNavigation && onNavigate ? (
              <button
                type="button"
                onClick={onNavigate}
                className={actionClass}
              >
                <MapPin
                  aria-hidden
                  className="h-5 w-5 shrink-0 sz-club-accent-text"
                />
                Navigation
              </button>
            ) : null}
          </div>
        </div>
      </TournamentCollapsibleSection>
      <Link
        to={publicTeamTournamentPath(tournamentEventId)}
        state={{ returnTo: location.pathname + location.search }}
        className={`${actionClass} w-full`}
      >
        <ExternalLink
          aria-hidden
          className="h-5 w-5 shrink-0 sz-club-accent-text"
        />
        Turnierseite ansehen
      </Link>
      <button
        type="button"
        onClick={() => void share()}
        className={`${actionClass} w-full`}
      >
        <Share2 aria-hidden className="h-5 w-5 shrink-0 sz-club-accent-text" />
        Turnierseite teilen
      </button>
      {hint ? (
        <p className="text-[14px] text-white/70" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
