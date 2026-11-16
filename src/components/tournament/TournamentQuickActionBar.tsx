import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ThumbsUp, ThumbsDown, CalendarPlus, CalendarDays, Clock3, Users, MapPin, Navigation, Share2, ExternalLink } from "lucide-react";
import { Modal } from "../../app/ui/Modal";
import {
  publicTeamTournamentPath,
  sharePublicTeamTournamentPage,
} from "../../lib/publicTeamTournament";

const actionClass =
  "sz-club-event-action inline-flex min-h-12 min-w-0 flex-col sm:flex-row items-center justify-center gap-1 rounded-[16px] border px-2 py-2 text-[14px] font-semibold text-white/80 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white touch-manipulation";
export function TournamentQuickActionBar({
  shareTitle,
  tournamentEventId,
  location: venue,
  dateLabel, startLabel, meetingLabel,
}: {
  shareTitle: string;
  tournamentEventId: string;
  location?: string | null;
  dateLabel?: string; startLabel?: string; meetingLabel?: string | null;
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
      <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Turnierdetails" className="tournamentWorkflowModal tournament-details-modal">
        <h2 className="mb-4 text-xl font-extrabold text-white">{shareTitle}</h2>
        <dl className="grid gap-3">{[{label:'Datum',value:dateLabel,Icon:CalendarDays},{label:'Treffpunkt',value:meetingLabel?`${meetingLabel} Uhr`:null,Icon:Users},{label:'Beginn',value:startLabel?`${startLabel} Uhr`:null,Icon:Clock3},{label:'Spielort',value:venue?.trim()||'Spielort noch offen',Icon:MapPin}].filter(row=>row.value).map(({label,value,Icon})=><div key={label} className="flex gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3"><Icon className="mt-1 h-5 w-5 shrink-0 sz-club-accent-text" aria-hidden/><div><dt className="text-sm font-semibold text-white/60">{label}</dt><dd className="mt-1 whitespace-pre-line text-base font-bold text-white">{value}</dd></div></div>)}</dl>
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

export function TournamentAttendanceButton({status,onOpen}:{status:string|null;onOpen:()=>void}) {
 const label=status==='yes'?'Zugesagt':status==='no'?'Abgesagt':'Offen';
 const Icon=status==='no'?ThumbsDown:ThumbsUp;
 const color=status==='yes'?'border-emerald-400/40 bg-emerald-500/15 text-emerald-300':status==='no'?'border-red-400/40 bg-red-500/15 text-red-300':'border-white/20 text-white/70';
 return <button type="button" onClick={onOpen} aria-haspopup="dialog" aria-label={`Teilnahme: ${label} · Zu-/Absage öffnen`} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-3 text-sm font-bold ${color}`}><Icon className="h-5 w-5" aria-hidden/>{label}</button>;
}
