/**
 * Zentrale Demo-Datenquelle für produktive Komponenten (STEP DEMO.2A).
 * Keine Supabase-IDs echter Teams — nur lokale Fixtures.
 */

import type { EventRow } from '../hooks/useEvents';
import type { ClassifiedFeedPost, TeamFeedPostDbRow } from '../lib/matchdayFeedTypes';
import { demoFixtures } from './demoFixtures';

export const DEMO_TEAM_SEASON_ID = '00000000-demo-4000-8000-teamseasonu12';
export const DEMO_TEAM_ID = '00000000-demo-4000-8000-teamrohrbach';
export const DEMO_MATCH_ID_LIVE = '00000000-demo-4000-8000-matchloosdorf';
export const DEMO_MATCH_ID_PAST = '00000000-demo-4000-8000-matchstveit';

const TEAM = demoFixtures.teamName;
const SEASON = demoFixtures.seasonLabel;

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

/** Events für Home-Hero / Compact-Cards (produktive EventRow-Form). */
export function buildDemoEvents(): EventRow[] {
  return demoFixtures.events.map((ev) => {
    const kind =
      ev.kind === 'game'
        ? ('match' as const)
        : ev.kind === 'training'
          ? ('training' as const)
          : ev.kind === 'tournament'
            ? ('tournament' as const)
            : ('event' as const);
    const isPast = new Date(ev.starts_at).getTime() < Date.now() - 2 * 24 * 60 * 60 * 1000;
    return toEventRow({
      id: ev.id,
      kind,
      starts_at: ev.starts_at,
      meeting_at: ev.meetingAt ?? null,
      location: ev.location,
      opponent: ev.opponent ?? null,
      is_home: ev.isHome ?? null,
      notes: ev.notes ?? null,
      status: isPast && kind === 'match' ? 'finished' : 'upcoming',
      match_id:
        ev.id === 'ev-game-next'
          ? DEMO_MATCH_ID_LIVE
          : ev.id === 'ev-game-past'
            ? DEMO_MATCH_ID_PAST
            : null,
    });
  });
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

  const all: ClassifiedFeedPost[] = [
    {
      kind: 'championship_schedule',
      post: basePost({
        id: 'df-season-start',
        post_kind: 'championship_schedule_published',
        media_type: 'championship_schedule',
        caption: `Saisonstart ${SEASON} · ${our}. Termine und Training sind vorbereitet.`,
        created_at: '2026-08-10T08:00:00+02:00',
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
          created_at: '2026-08-26T08:00:00+02:00',
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
          kickoff_iso: '2026-08-27T17:00:00+02:00',
          meeting_iso: null,
          location: 'Sportplatz Rohrbach',
          match_id: null,
          event_id: 'ev-train-next',
          deep_link: '/demo/training',
        },
      },
    },
    {
      kind: 'championship_match_changed',
      post: basePost({
        id: 'df-schedule-change',
        post_kind: 'championship_match_changed',
        media_type: 'championship_match_changed',
        caption: 'Terminänderung: Training am 20.08. beginnt um 17:00 (statt 16:45).',
        created_at: '2026-08-19T09:30:00+02:00',
        event_id: 'ev-train-past',
        payload: {
          title: 'Terminänderung',
          detail: 'Training 15 Min. später',
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
        created_at: '2026-08-15T19:30:00+02:00',
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
        created_at: '2026-08-21T18:00:00+02:00',
        media_type: 'matchday',
        payload: {
          display_home_name: our,
          display_away_name: stVeit,
          our_team_name: our,
          is_home: true,
          opponent_logo_url: null,
          match_type: 'championship',
          kickoff_iso: '2026-08-23T10:00:00+02:00',
          meeting_iso: '2026-08-23T09:15:00+02:00',
          location: 'Sportplatz Rohrbach',
          match_id: DEMO_MATCH_ID_PAST,
          event_id: 'ev-game-past',
          deep_link: '/demo/match',
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
          created_at: '2026-08-22T20:00:00+02:00',
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
          starts_at: '2026-08-23T10:00:00+02:00',
          deep_link: '/demo/match',
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
          created_at: '2026-08-30T10:45:00+02:00',
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
          starts_at: '2026-08-30T10:30:00+02:00',
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
          created_at: '2026-08-23T11:45:00+02:00',
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
          starts_at: '2026-08-23T10:00:00+02:00',
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
          deep_link: '/demo/match',
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
        created_at: '2026-08-24T16:00:00+02:00',
        event_id: 'ev-tournament',
        payload: {
          tournament_name: demoFixtures.tournament.name,
          location: demoFixtures.tournament.location,
          deep_link: '/demo/turnier',
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
        created_at: '2026-08-25T14:00:00+02:00',
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
