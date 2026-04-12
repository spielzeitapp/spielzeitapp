import type { EventRow } from '../../hooks/useEvents';
import type { MatchFeedSettingsRow } from '../../types/matchFeedSettings';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../../components/match/matchCardLabels';
import type { MatchdayHeroCardProps } from '../../components/feed/MatchdayHeroCard';
import { splitStatusForHero } from './homeFeedBuilder';

/** Platzhalter wenn in den Event-Daten kein Gegner-Name gesetzt ist (kein fester Vereinsname). */
const MISSING_NAME = '–';

function formatKickoffTime(startsAt: string | null): string {
  if (!startsAt) return '–';
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return '–';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Reine Abbildung: Event + Feed-Row → Props für {@link MatchdayHeroCard} (kein I/O).
 */
export function buildMatchdayHeroCardProps(args: {
  event: EventRow;
  feed: MatchFeedSettingsRow;
  statusLabel: string;
}): MatchdayHeroCardProps {
  const { event, feed, statusLabel } = args;
  const ourClubName = getOurTeamDisplayName();
  const oppRaw = (event.opponent ?? '').trim();
  const opponentDisplay = oppRaw || MISSING_NAME;
  const isHome = event.is_home;

  let homeTeam: string;
  let awayTeamLabel: string;
  let matchLeftName: string;
  let matchRightName: string;
  let matchLeftColLabel: string;
  let matchRightColLabel: string;

  if (isHome === true) {
    homeTeam = ourClubName;
    awayTeamLabel = opponentDisplay;
    matchLeftName = ourClubName;
    matchRightName = opponentDisplay;
    matchLeftColLabel = 'Heim';
    matchRightColLabel = 'Gegner';
  } else if (isHome === false) {
    homeTeam = ourClubName;
    awayTeamLabel = opponentDisplay;
    matchLeftName = opponentDisplay;
    matchRightName = ourClubName;
    matchLeftColLabel = 'Gegner';
    matchRightColLabel = 'Heim';
  } else {
    homeTeam = ourClubName;
    awayTeamLabel = opponentDisplay;
    matchLeftName = ourClubName;
    matchRightName = opponentDisplay;
    matchLeftColLabel = 'Team';
    matchRightColLabel = 'Gegner';
  }

  const { lead, emphasis } = splitStatusForHero(statusLabel);
  const headline = (feed.headline_override ?? '').trim();
  const sublineOv = (feed.subline_override ?? '').trim();
  const title = headline || emphasis || statusLabel;
  const titleLead = headline ? null : lead || null;
  const subtitle = sublineOv || (oppRaw ? `Gegen ${oppRaw}` : null);

  const parsedLocation = splitCombinedLocation(event.location);
  const placeLine = parsedLocation.place;
  const addressLine = parsedLocation.address || (event.address ?? '').trim();
  const locCombined = (formatFullLocation(placeLine, addressLine) || '').trim();
  const location = locCombined.length > 0 ? locCombined : null;

  const meetupFormatted = formatMeetupTimeOnlyDe(event.meeting_at).trim();
  const meetup = meetupFormatted.length > 0 ? meetupFormatted : null;
  const kickoff = formatKickoffTime(event.starts_at);

  const noteParts = (event.notes ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
  const endRaw = noteParts.find((p) => p.toLowerCase().startsWith('ende:'));
  const endTimeLabel = endRaw
    ? endRaw.replace(/^ende:\s*/i, '').replace(/\s*uhr\s*$/i, '').trim()
    : null;
  const descriptionParts = noteParts.slice(1).filter((p) => !p.toLowerCase().startsWith('ende:'));
  const descriptionText = descriptionParts.length ? descriptionParts.join(' · ') : null;

  const meetupTimeOnly = formatMeetupTimeOnlyDe(event.meeting_at);
  const matchTypeLine = getMatchTypeLabel(event.match_type ?? event.type);

  return {
    templateKey: feed.template_key,
    title,
    titleLead,
    subtitle,
    homeTeam,
    opponent: awayTeamLabel,
    isHome,
    matchLeftName,
    matchRightName,
    matchLeftColLabel,
    matchRightColLabel,
    kickoff,
    meetup,
    location,
    teamLogoUrl: null,
    opponentLogoUrl: feed.opponent_logo_url,
    playerImageUrl: feed.player_image_url,
    matchTypeLine,
    meetupTimeOnly,
    endTimeLabel,
    descriptionText,
    eventId: event.id,
    ctaLabel: 'Details & Zu-/Absage',
  };
}
