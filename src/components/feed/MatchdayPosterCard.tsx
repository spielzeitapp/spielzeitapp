import React from 'react';
import { buildFeedMatchMetaLine, pickFeedAgeGroup } from '../../lib/feedClubNaming';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import { FEED_HASHTAG } from './feedTypography';
import { MatchdayPosterArtwork } from './MatchdayPosterArtwork';

const SHELL_SHADOW =
  '0 0 0 1px rgba(220, 38, 38, 0.12), 0 28px 56px -16px rgba(0, 0, 0, 0.85), 0 0 80px -28px rgba(220, 38, 38, 0.22)';

export type MatchdayPosterVisualStatus = 'today' | 'live' | 'finished';
export type MatchdayAnnouncementTiming = 'today' | 'tomorrow';

export type MatchdayPosterCardProps = {
  homeTeamName: string;
  awayTeamName: string;
  homeLogoUrl: string;
  awayLogoUrl: string;
  kickoffTime: string;
  ageGroup?: string | null;
  matchDate?: string | null;
  meetingTime: string | null;
  locationLine: string;
  venueLabel: string;
  status: MatchdayPosterVisualStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  matchType?: string | null;
  announcementTiming?: MatchdayAnnouncementTiming | null;
  compact?: boolean;
  playerImageUrl?: string | null;
};

function heroKickoffDisplay(
  kickoffTime: string,
  status: MatchdayPosterVisualStatus,
  homeScore?: number | null,
  awayScore?: number | null,
): { main: string; suffix: string | null; livePulse: boolean } {
  if (status === 'live') return { main: 'LIVE', suffix: null, livePulse: true };
  if (status === 'finished') {
    const hs = homeScore != null ? homeScore : null;
    const aws = awayScore != null ? awayScore : null;
    if (hs != null && aws != null) return { main: `${hs} : ${aws}`, suffix: 'ENDSTAND', livePulse: false };
    return { main: 'ENDSTAND', suffix: null, livePulse: false };
  }
  const time = kickoffTime.replace(/\s*uhr\s*$/i, '').trim() || '—';
  return { main: time, suffix: 'UHR', livePulse: false };
}

export const MatchdayPosterCard = React.forwardRef<HTMLDivElement, MatchdayPosterCardProps>(
  function MatchdayPosterCard(
    {
      homeTeamName,
      awayTeamName,
      homeLogoUrl,
      awayLogoUrl,
      kickoffTime,
      ageGroup = null,
      matchDate = null,
      meetingTime,
      locationLine,
      venueLabel,
      status,
      homeScore,
      awayScore,
      matchType,
      announcementTiming = null,
      compact = false,
      playerImageUrl = null,
    },
    ref,
  ) {
    const typeLabel = getMatchTypeLabel(matchType ?? undefined);
    const showAnnouncement = announcementTiming && status === 'today';
    const competitionLabel = buildFeedMatchMetaLine(
      ageGroup?.trim() || pickFeedAgeGroup(homeTeamName, awayTeamName),
      typeLabel,
    );
    const heroKickoff = heroKickoffDisplay(kickoffTime, status, homeScore, awayScore);
    const isHomeGame = venueLabel.toLowerCase().includes('heim');
    const statusLabel =
      showAnnouncement && announcementTiming === 'tomorrow'
        ? 'MORGEN IST SPIELTAG'
        : showAnnouncement && announcementTiming === 'today'
          ? 'HEUTE IST SPIELTAG'
          : status === 'live'
            ? 'LIVE'
            : status === 'finished'
              ? 'ENDSTAND'
              : 'MATCHDAY';
    const showStatusBadge = status === 'live' || status === 'finished';
    const statusBadge =
      status === 'live'
        ? 'LIVE'
        : status === 'finished'
          ? homeScore != null && awayScore != null
            ? `ENDSTAND ${homeScore}:${awayScore}`
            : 'ENDSTAND'
          : null;

    return (
      <div
        ref={ref}
        className="relative w-full overflow-hidden rounded-none border-y border-red-500/40 p-[1px] sm:rounded-3xl sm:border"
        style={{ boxShadow: SHELL_SHADOW }}
      >
        <MatchdayPosterArtwork
          statusLabel={statusLabel}
          title="SPIELTAG"
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          homeLogoUrl={homeLogoUrl}
          awayLogoUrl={awayLogoUrl}
          kickoffTime={kickoffTime}
          matchDate={matchDate}
          meetingTime={meetingTime}
          location={locationLine}
          competitionLabel={competitionLabel}
          isHomeGame={isHomeGame}
          hashtag={FEED_HASHTAG}
          heroOverride={showStatusBadge ? heroKickoff : undefined}
          statusBadge={showStatusBadge ? statusBadge : null}
          compact={compact}
          playerImageUrl={playerImageUrl}
        />
      </div>
    );
  },
);

MatchdayPosterCard.displayName = 'MatchdayPosterCard';
