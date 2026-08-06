import type { EventRow } from '../hooks/useEvents';
import type { ClassifiedFeedPost, TeamFeedPostDbRow } from '../lib/matchdayFeedTypes';
import { demoFixtures } from './demoFixtures';
import { demoMinutesFromNowIso, demoOffsetIso } from './demoTime';
import { buildDemoTrainingHistoryEventRows } from './demoTrainingStats';

export const DEMO_TEAM_SEASON_ID = '00000000-demo-4000-8000-teamseasonu12';
export const DEMO_TEAM_ID = '00000000-demo-4000-8000-teamrohrbach';
export const DEMO_MATCH_ID_LIVE = '00000000-demo-4000-8000-matchloosdorf';
export const DEMO_MATCH_ID_PAST = '00000000-demo-4000-8000-matchstveit';

const TEAM = demoFixtures.teamName;
const SEASON = demoFixtures.seasonLabel;

/** Relative Ankerzeiten — konsistent zu Feed und Terminen. */
export const DEMO_EVENT_TIMES = {
  'ev-info': () => ({ starts: demoOffsetIso(-22, 19, 0) }),
  'ev-train-canceled': () => ({ starts: demoOffsetIso(-14, 17, 0), ends: demoOffsetIso(-14, 18, 20) }),
  'ev-train-past': () => ({ starts: demoOffsetIso(-7, 17, 0), ends: demoOffsetIso(-7, 18, 20) }),
  'ev-game-past': () => ({ starts: demoOffsetIso(-4, 10, 0), meeting: demoOffsetIso(-4, 9, 15) }),
  'ev-train-next': () => ({ starts: demoOffsetIso(2, 17, 0), ends: demoOffsetIso(2, 18, 20) }),
  'ev-train-follow': () => ({ starts: demoOffsetIso(9, 17, 0), ends: demoOffsetIso(9, 18, 20) }),
  'ev-game-next': () => ({
    starts: demoMinutesFromNowIso(-48),
    meeting: demoMinutesFromNowIso(-93),
  }),
  'ev-tournament': () => ({ starts: demoOffsetIso(14, 9, 0), ends: demoOffsetIso(14, 16, 0) }),
  'ev-teamabend': () => ({ starts: demoOffsetIso(20, 18, 0), ends: demoOffsetIso(20, 20, 0) }),
  'ev-game-away': () => ({ starts: demoOffsetIso(28, 10, 0) }),
} as const;

function basePost(
  partial: Pick<TeamFeedPostDbRow, 'id' | 'post_kind' | 'caption' | 'created_at' | 'media_type'> & {
    event_id?: string | null;
    payload?: unknown;
    media_url?: string | null;
  },
): TeamFeedPostDbRow {
  return {
    id: partial.id,
    team_season_id: DEMO_TEAM_SEASON_ID,
    team_id: DEMO_TEAM_ID,
    event_id: partial.event_id ?? null,
    post_kind: partial.post_kind,
    caption: partial.caption,
    payload: partial.payload ?? {},
    created_at: partial.created_at,
    media_type: partial.media_type,
    media_url: partial.media_url ?? null,
    thumbnail_url: null,
    duration_seconds: null,
  };
}

function toEventRow(
  partial: Partial<EventRow> & Pick<EventRow, 'id' | 'starts_at' | 'kind'>,
): EventRow {
  const kind = partial.kind;
  return {
    id: partial.id,
    team_season_id: DEMO_TEAM_SEASON_ID,
    kind,
    type: kind === 'match' ? 'game' : kind === 'training' ? 'training' : kind === 'tournament' ? 'event' : 'event',
    match_type: partial.match_type ?? (kind === 'match' ? 'championship' : null),
    opponent: partial.opponent ?? null,
    is_home: partial.is_home ?? true,
    location: partial.location ?? 'Sportplatz Rohrbach',
    address: partial.address ?? null,
    starts_at: partial.starts_at,
    meeting_at: partial.meeting_at ?? null,
    status: partial.status ?? 'upcoming',
    attendance_mode: partial.attendance_mode ?? 'opt_in',
    notes: partial.notes ?? null,
    match_id: partial.match_id ?? null,
    series_id: partial.series_id ?? null,
    training_absence_deadline_disabled: null,
    created_by: null,
    created_at: partial.created_at ?? partial.starts_at,
    updated_at: null,
    fixture_status: null,
  };
}

/** Events für Home / Termine / Kalender / EventDetail (produktive EventRow-Form). */
export function buildDemoEvents(): EventRow[] {
  const fromFixtures = demoFixtures.events.map((ev) => {
    const kind =
      ev.kind === 'game'
        ? ('match' as const)
        : ev.kind === 'training'
          ? ('training' as const)
          : ev.kind === 'tournament'
            ? ('tournament' as const)
            : ('event' as const);
    const timesFn = DEMO_EVENT_TIMES[ev.id as keyof typeof DEMO_EVENT_TIMES];
    const times = timesFn
      ? timesFn()
      : { starts: ev.startsAt, meeting: ev.meetingAt ?? undefined, ends: ev.endsAt ?? undefined };
    const startsAt = times.starts;
    const meetingAt =
      typeof (times as { meeting?: string }).meeting === 'string'
        ? (times as { meeting: string }).meeting
        : ev.meetingAt ?? null;
    const canceled = ev.id === 'ev-train-canceled' || /\babgesagt\b/i.test(ev.title);
    let status: EventRow['status'] = 'upcoming';
    if (canceled) status = 'canceled';
    else if (kind === 'match' && ev.id === 'ev-game-next') status = 'upcoming';
    else if (kind === 'match' && ev.id === 'ev-game-past') status = 'finished';
    else if (kind === 'match' && ev.id === 'ev-game-away') status = 'upcoming';
    else if (ev.id === 'ev-train-past' || ev.id === 'ev-info') status = 'finished';
    else if (ev.id.startsWith('ev-train-h')) status = 'finished';

    const titleNote =
      ev.kind === 'event' || ev.kind === 'info' || ev.kind === 'tournament'
        ? [ev.title, ev.notes].filter(Boolean).join('\n')
        : ev.notes ?? null;

    return toEventRow({
      id: ev.id,
      kind,
      starts_at: startsAt,
      meeting_at: meetingAt,
      location: ev.location,
      opponent: ev.opponent ?? null,
      is_home: ev.isHome ?? null,
      notes: titleNote,
      status,
      match_id:
        ev.id === 'ev-game-next'
          ? DEMO_MATCH_ID_LIVE
          : ev.id === 'ev-game-past'
            ? DEMO_MATCH_ID_PAST
            : ev.id === 'ev-game-away'
              ? '00000000-demo-4000-8000-matchsknaway'
              : null,
      fixture_status: kind === 'match' ? 'published' : null,
    });
  });

  // Historische Trainings für Quote/Ranking (DEMO.2D)
  return [...fromFixtures, ...buildDemoTrainingHistoryEventRows()];
}

/**
 * Feed-Posts in produktiver ClassifiedFeedPost-Form.
 * Chronik der Demo-Saison — deep_links zeigen auf /demo/*, nie auf echte Team-IDs.
 * active = aktuelle Posts; historic = ältere Chronik (wie produktiver Feed).
 */
export function buildDemoFeedPosts(): {
  active: ClassifiedFeedPost[];
  historic: ClassifiedFeedPost[];
} {
  const our = TEAM;
  const loosdorf = 'SV Loosdorf U12';
  const stVeit = 'SC St. Veit U12';
  const tInfo = DEMO_EVENT_TIMES['ev-info']();
  const tTrainPast = DEMO_EVENT_TIMES['ev-train-past']();
  const tTrainNext = DEMO_EVENT_TIMES['ev-train-next']();
  const tGamePast = DEMO_EVENT_TIMES['ev-game-past']();
  const tGameNext = DEMO_EVENT_TIMES['ev-game-next']();
  const tTournament = DEMO_EVENT_TIMES['ev-tournament']();

  const all: ClassifiedFeedPost[] = [
    {
      kind: 'championship_schedule',
      post: basePost({
        id: 'df-season-start',
        post_kind: 'championship_schedule_published',
        media_type: 'championship_schedule',
        caption: `Saisonstart ${SEASON} · ${our}. Termine und Training sind vorbereitet.`,
        created_at: demoOffsetIso(-25, 8, 0),
        payload: {
          season_label: SEASON,
          team_name: our,
          title: `Saisonstart U12 ${SEASON}`,
        },
      }),
    },
    {
      kind: 'next_match',
      post: {
        ...basePost({
          id: 'df-next-training',
          post_kind: 'next_match_auto',
          media_type: 'next_match',
          caption: 'Nächstes Training · 1 gegen 1 und schnelles Umschalten',
          created_at: demoOffsetIso(1, 8, 0),
          event_id: 'ev-train-next',
          payload: {},
        }),
        payload: {
          display_home_name: our,
          display_away_name: 'Training',
          our_team_name: our,
          is_home: true,
          opponent_logo_url: null,
          match_type: null,
          kickoff_iso: tTrainNext.starts,
          meeting_iso: null,
          location: 'Sportplatz Rohrbach',
          match_id: null,
          event_id: 'ev-train-next',
          deep_link: '/demo/events/ev-train-next',
        },
      },
    },
    {
      kind: 'championship_match_changed',
      post: basePost({
        id: 'df-schedule-change',
        post_kind: 'championship_match_changed',
        media_type: 'championship_match_changed',
        caption: 'Terminänderung: Training beginnt um 17:00 (statt 16:45).',
        created_at: demoOffsetIso(-8, 9, 30),
        event_id: 'ev-train-past',
        payload: {
          title: 'Terminänderung',
          detail: 'Training 15 Min. später',
          event_id: 'ev-train-past',
          deep_link: '/demo/events/ev-train-past',
        },
      }),
    },
    {
      kind: 'image',
      post: basePost({
        id: 'df-parent-info',
        post_kind: 'manual_image',
        media_type: 'image',
        caption: 'Elterninformation – Saisonstart im Vereinsheim Rohrbach. Bitte Zusagen prüfen.',
        created_at: tInfo.starts,
        event_id: 'ev-info',
        // Neutrale Platzhalter-Grafik (kein Kinderfoto)
        media_url: '/icons/pitch.svg',
        payload: {},
      }),
    },
    {
      kind: 'matchday',
      post: {
        id: 'df-squad',
        team_season_id: DEMO_TEAM_SEASON_ID,
        team_id: DEMO_TEAM_ID,
        event_id: 'ev-game-past',
        post_kind: 'matchday_auto',
        caption: `Kader freigegeben · vs. ${stVeit}`,
        created_at: demoOffsetIso(-5, 18, 0),
        media_type: 'matchday',
        payload: {
          display_home_name: our,
          display_away_name: stVeit,
          our_team_name: our,
          is_home: true,
          opponent_logo_url: null,
          match_type: 'championship',
          kickoff_iso: tGamePast.starts,
          meeting_iso: tGamePast.meeting ?? null,
          location: 'Sportplatz Rohrbach',
          match_id: DEMO_MATCH_ID_PAST,
          event_id: 'ev-game-past',
          deep_link: '/demo/events/ev-game-past',
        },
      },
    },
    {
      kind: 'lineup',
      post: {
        ...basePost({
          id: 'df-lineup',
          post_kind: 'lineup_auto',
          media_type: 'lineup',
          caption: 'Aufstellung fertig · Formation 2-3-1',
          created_at: demoOffsetIso(-5, 20, 0),
          event_id: 'ev-game-past',
          payload: {},
        }),
        payload: {
          match_id: DEMO_MATCH_ID_PAST,
          event_id: 'ev-game-past',
          team_season_id: DEMO_TEAM_SEASON_ID,
          formation: demoFixtures.formation,
          lineup_players: demoFixtures.lineup
            .filter((s) => s.role === 'start')
            .map((s) => {
              const p = demoFixtures.players.find((x) => x.id === s.playerId)!;
              return {
                player_id: p.id,
                name: `${p.firstName} ${p.lastInitial}`,
                playerName: `${p.firstName} ${p.lastInitial}`,
                slot: s.positionLabel,
                positionLabel: s.positionLabel,
                jersey_number: p.jersey,
              };
            }),
          bench_players: demoFixtures.lineup
            .filter((s) => s.role === 'bench')
            .map((s) => {
              const p = demoFixtures.players.find((x) => x.id === s.playerId)!;
              return {
                player_id: p.id,
                name: `${p.firstName} ${p.lastInitial}`,
                playerName: `${p.firstName} ${p.lastInitial}`,
                slot: s.positionLabel,
                positionLabel: s.positionLabel,
                jersey_number: p.jersey,
              };
            }),
          starts_at: tGamePast.starts,
          deep_link: '/demo/events/ev-game-past',
          our_team_name: our,
          opponent_name: stVeit,
          is_home: true,
        },
      },
    },
    {
      kind: 'live',
      post: {
        ...basePost({
          id: 'df-live',
          post_kind: 'live_auto',
          media_type: 'live',
          caption: `LIVE · ${our} – ${loosdorf}`,
          created_at: demoMinutesFromNowIso(-45),
          event_id: 'ev-game-next',
          payload: {},
        }),
        payload: {
          match_id: DEMO_MATCH_ID_LIVE,
          event_id: 'ev-game-next',
          team_season_id: DEMO_TEAM_SEASON_ID,
          home_team_name: our,
          away_team_name: loosdorf,
          home_logo_url: '',
          away_logo_url: '',
          starts_at: tGameNext.starts,
          location: 'Sportplatz Rohrbach',
          match_type: 'championship',
          status: 'live',
          deep_link: '/demo/live',
        },
      },
    },
    {
      kind: 'result',
      post: {
        ...basePost({
          id: 'df-result',
          post_kind: 'result_auto',
          media_type: 'result',
          caption: `Endergebnis ${our} – ${stVeit} 3:1`,
          created_at: demoOffsetIso(-4, 11, 45),
          event_id: 'ev-game-past',
          payload: {},
        }),
        payload: {
          match_id: DEMO_MATCH_ID_PAST,
          event_id: 'ev-game-past',
          team_season_id: DEMO_TEAM_SEASON_ID,
          home_team_name: our,
          away_team_name: stVeit,
          home_logo_url: '',
          away_logo_url: '',
          home_score: 3,
          away_score: 1,
          match_type: 'championship',
          starts_at: tGamePast.starts,
          meeting_at: null,
          location: 'Sportplatz Rohrbach',
          scorers: [
            { player_name: 'Elias F.', minute_label: "18'" },
            { player_name: 'Noah K.', minute_label: "41'" },
            { player_name: 'Jonas W.', minute_label: "62'" },
          ],
          period_scores: null,
          result_state: 'win',
          our_team_name: our,
          is_home: true,
          deep_link: '/demo/events/ev-game-past',
        },
      },
    },
    {
      kind: 'tournament_completion',
      post: basePost({
        id: 'df-tournament',
        post_kind: 'tournament_completion_manual',
        media_type: 'tournament_completion',
        caption: 'U12-Sommerturnier St. Veit · Gruppe Platz 2, Finale am Nachmittag.',
        created_at: demoOffsetIso(-3, 16, 0),
        event_id: 'ev-tournament',
        payload: {
          tournament_name: demoFixtures.tournament.name,
          location: demoFixtures.tournament.location,
          deep_link: '/demo/events/ev-tournament',
          event_id: 'ev-tournament',
        },
      }),
    },
    {
      kind: 'image',
      post: basePost({
        id: 'df-moment',
        post_kind: 'manual_image',
        media_type: 'image',
        caption: 'Mannschaftsmoment (Demo-Platzhalter) · starke Woche, Challenge 85 %+ erreicht.',
        created_at: demoOffsetIso(-2, 14, 0),
        media_url: '/icons/team.svg',
        payload: {},
      }),
    },
  ];

  const sorted = all.sort(
    (a, b) => new Date(b.post.created_at).getTime() - new Date(a.post.created_at).getTime(),
  );
  /** Neuere Posts im aktiven Feed; ältere in der Chronik (wie produktive Trennung). */
  return {
    active: sorted.slice(0, 6),
    historic: sorted.slice(6),
  };
}

export type DemoDataSource = {
  teamName: string;
  seasonLabel: string;
  teamSeasonId: string;
  teamId: string;
  events: EventRow[];
  feedPosts: ClassifiedFeedPost[];
  historicFeedPosts: ClassifiedFeedPost[];
};
