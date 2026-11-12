import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CalendarPlus, MapPin, Navigation, Share2, ExternalLink } from "lucide-react";
import { Modal } from "../../app/ui/Modal";
import {
  publicTeamTournamentPath,
  sharePublicTeamTournamentPage,
} from "../../lib/publicTeamTournament";

const actionClass =
  "inline-flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[15px] font-semibold text-white/80 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white touch-manipulation";
export function TournamentQuickActionBar({
  shareTitle,
  tournamentEventId,
  location: venue,
}: {
  shareTitle: string;
  tournamentEventId: string;
  location?: string | null;
}) {
  const location = useLocation();
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1" role="group" aria-label="Turnierdetails und öffentliche Turnierseite">
        <button type="button" onClick={() => setDetailsOpen(true)} className={actionClass} aria-label="Turnierdetails öffnen" aria-haspopup="dialog">
          <MapPin className="h-5 w-5 sz-club-accent-text" aria-hidden />
          Details
        </button>
        <Link to={publicTeamTournamentPath(tournamentEventId)} state={{ returnTo: location.pathname + location.search }} className={actionClass} aria-label="Turnierseite ansehen">
          <ExternalLink className="h-5 w-5 sz-club-accent-text" aria-hidden />
          Turnierseite
        </Link>
        <button type="button" onClick={() => void share()} className={actionClass} aria-label="Turnierseite teilen">
          <Share2 className="h-5 w-5 sz-club-accent-text" aria-hidden />
          Teilen
        </button>
      </div>
      {hint ? <p className="px-2 text-[14px] text-white/70" role="status">{hint}</p> : null}
      <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Turnierdetails">
        <h2 className="text-[18px] font-bold text-white">Spielort</h2>
        <p className="mt-2 whitespace-pre-line text-[17px] leading-relaxed text-white/75">{venue?.trim() || 'Spielort noch offen'}</p>
      </Modal>
    </div>
  );
}

/** Round actions shared with carpooling, reminders and tournament management. */
export function TournamentHeaderQuickActions(props: {
  kind: 'calendar'; onAddToCalendar: () => void;
} | {
  kind: 'navigation'; onNavigate?: () => void; showNavigation: boolean;
}) {
  const roundActionClass = "sz-club-event-action inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  if (props.kind === 'calendar') return (
    <button type="button" onClick={props.onAddToCalendar} className={roundActionClass} aria-label="Zum Kalender hinzufügen" title="Zum Kalender hinzufügen">
      <CalendarPlus className="h-5 w-5 sz-club-accent-text" aria-hidden />
    </button>
  );
  return props.showNavigation && props.onNavigate ? (
    <button type="button" onClick={props.onNavigate} className={roundActionClass} aria-label="Navigation zum Spielort starten" title="Navigation zum Spielort starten">
      <Navigation className="h-5 w-5 sz-club-accent-text" aria-hidden />
    </button>
  ) : null;
}
