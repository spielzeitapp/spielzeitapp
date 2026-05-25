import type { EventRow } from '../../hooks/useEvents';
import {
  getDateTimePartsInTimeZone,
  isNextViennaCalendarDay,
  isSameViennaCalendarDay,
  VIENNA_TZ,
} from '../../lib/viennaTime';

export type HomeMessage = {
  id: string;
  title: string;
  body: string | null;
  content: string | null;
  created_at: string;
};

/** Aus event_attendance + Eltern-Kontext (keine neue DB-Struktur). */
export type HomeFeedAttendance = {
  openReminder: {
    event: EventRow;
    unansweredChildren: number;
  } | null;
};

export type HomeFeatured =
  | { type: 'matchday'; event: EventRow }
  | { type: 'next_event'; event: EventRow };

export type HomeFeedItem =
  | { type: 'next_event'; event: EventRow }
  | { type: 'reminder'; event: EventRow; unansweredChildren: number }
  | { type: 'news'; message: HomeMessage; trainerLabel?: string };

export type HomeFeedResult = {
  featured: HomeFeatured | null;
  items: HomeFeedItem[];
};

export type BuildHomeFeedArgs = {
  events: EventRow[];
  messages: HomeMessage[];
  attendance: HomeFeedAttendance;
  now: Date;
};

function isSameCalendarDayVienna(a: Date, b: Date): boolean {
  const pa = getDateTimePartsInTimeZone(a, VIENNA_TZ);
  const pb = getDateTimePartsInTimeZone(b, VIENNA_TZ);
  if (!pa || !pb) return false;
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

export function isUpcomingRelevant(e: EventRow, _now: Date): boolean {
  const st = e.status ?? 'upcoming';
  if (st === 'finished' || st === 'canceled') return false;
  return true;
}

export function nextUpcoming(events: EventRow[], now: Date): EventRow | null {
  const upcoming = events
    .filter((e) => isUpcomingRelevant(e, now))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return upcoming[0] ?? null;
}

export function nextUpcomingExcluding(
  events: EventRow[],
  now: Date,
  excludeId: string,
): EventRow | null {
  const upcoming = events
    .filter((e) => e.id !== excludeId && isUpcomingRelevant(e, now))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return upcoming[0] ?? null;
}

/** Erstes Ligaspiel (kind match) am selben Kalendertag wie `now` (Wien). */
export function findMatchToday(events: EventRow[], now: Date): EventRow | null {
  const matches = events.filter((e) => {
    if (e.kind !== 'match') return false;
    const st = e.status ?? 'upcoming';
    if (st === 'finished' || st === 'canceled') return false;
    if (!e.starts_at) return false;
    return isSameCalendarDayVienna(new Date(e.starts_at), now);
  });
  matches.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return matches[0] ?? null;
}

/**
 * Featured: Matchday (Spiel heute) oder nächster Termin.
 * Items: optional weiterer nächster Termin (wenn Featured Matchday), Reminder, letzte Nachricht.
 */
export function buildHomeFeed({
  events,
  messages,
  attendance,
  now,
}: BuildHomeFeedArgs): HomeFeedResult {
  const matchToday = findMatchToday(events, now);
  const next = nextUpcoming(events, now);

  let featured: HomeFeatured | null = null;
  if (matchToday) {
    featured = { type: 'matchday', event: matchToday };
  } else if (next) {
    featured = { type: 'next_event', event: next };
  }

  const items: HomeFeedItem[] = [];

  if (featured?.type === 'matchday') {
    const after = nextUpcomingExcluding(events, now, featured.event.id);
    if (after) {
      items.push({ type: 'next_event', event: after });
    }
  }

  const rem = attendance.openReminder;
  if (rem && rem.unansweredChildren > 0) {
    const sameAsFeaturedNextOnly =
      featured?.type === 'next_event' && featured.event.id === rem.event.id;
    if (!sameAsFeaturedNextOnly) {
      items.push({
        type: 'reminder',
        event: rem.event,
        unansweredChildren: rem.unansweredChildren,
      });
    }
  }

  const latest = messages[0];
  if (latest) {
    items.push({ type: 'news', message: latest, trainerLabel: 'Trainer' });
  }

  return { featured, items };
}

/** Countdown bis starts_at, grob für Feed („in 2h 15m“). */
export function formatCountdownToStartsAt(startsAtIso: string | null, now: Date): string {
  if (!startsAtIso) return '—';
  const t = new Date(startsAtIso).getTime();
  if (Number.isNaN(t)) return '—';
  let diff = Math.max(0, t - now.getTime());
  const days = Math.floor(diff / 86400000);
  diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `in ${days} Tag${days === 1 ? '' : 'en'} ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  if (mins > 0) return `in ${mins}m`;
  return 'gleich';
}

export function formatRelativeTimeDe(iso: string, now: Date): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  let sec = Math.floor((now.getTime() - t) / 1000);
  if (sec < 0) sec = 0;
  if (sec < 60) return 'gerade eben';
  const min = Math.floor(sec / 60);
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 48) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tag${d === 1 ? '' : 'en'}`;
}

export function eventKindLabel(kind: EventRow['kind']): string {
  if (kind === 'training') return 'Training';
  if (kind === 'event') return 'Termin';
  return 'Spiel';
}

/** Home Match-Card: nur `kind === match`, Priorität heute → morgen → nächstes Spiel. */
export type HomeMatchCardPick = {
  event: EventRow;
  status: 'today' | 'tomorrow' | 'next';
};

/** Statuszeilen für die Home Feed Hero Card (SPIELTAG statt MATCHDAY). */
export const HOME_FEED_HERO_STATUS_LABEL: Record<HomeMatchCardPick['status'], string> = {
  today: 'HEUTE IST SPIELTAG',
  tomorrow: 'MORGEN IST SPIELTAG',
  next: 'NÄCHSTES SPIEL',
};

/** Home: sachliche Überschrift wenn kein Spieltag (heute) – keine SPIELTAG-/MATCHDAY-Emotion. */
export const HOME_NEXT_MATCH_ORG_LABEL: Record<'tomorrow' | 'next', string> = {
  tomorrow: 'Spiel morgen',
  next: 'Nächstes Spiel',
};

/** Kleine Zeile + große Hero-Zeile aus Status-Label (z. B. Home / MatchdayHeroCard). */
export function splitStatusForHero(statusLabel: string): { lead: string; emphasis: string } {
  const parts = statusLabel.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { lead: '', emphasis: '' };
  if (parts.length === 1) return { lead: '', emphasis: parts[0] ?? '' };
  return { lead: parts.slice(0, -1).join(' '), emphasis: parts[parts.length - 1] ?? '' };
}

export function pickHomeMatchCard(events: EventRow[], now: Date): HomeMatchCardPick | null {
  const matches = events
    .filter((e) => {
      if (e.kind !== 'match') return false;
      const st = e.status ?? 'upcoming';
      if (st === 'finished' || st === 'canceled') return false;
      return true;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  if (matches.length === 0) return null;

  const today = matches.find((e) => isSameViennaCalendarDay(new Date(e.starts_at), now));
  if (today) return { event: today, status: 'today' };

  const tomorrow = matches.find((e) => isNextViennaCalendarDay(new Date(e.starts_at), now));
  if (tomorrow) return { event: tomorrow, status: 'tomorrow' };

  return { event: matches[0], status: 'next' };
}

/** Demo: nur Match-Events für Home (VITE_HOME_FEED_DEMO). */
export function buildDemoHomeMatchEvents(now: Date): EventRow[] {
  return buildDemoHomeFeedArgs(now).events.filter((e) => e.kind === 'match');
}

/** Demo-Seed für VITE_HOME_FEED_DEMO=1 (Mockup ohne DB). */
export function buildDemoHomeFeedArgs(now: Date): BuildHomeFeedArgs {
  const teamSeasonId = '00000000-0000-4000-8000-000000000001';
  const mk = (partial: Partial<EventRow> & Pick<EventRow, 'id' | 'starts_at' | 'kind'>): EventRow => ({
    id: partial.id,
    team_season_id: teamSeasonId,
    kind: partial.kind,
    type: partial.kind === 'match' ? 'game' : partial.kind === 'training' ? 'training' : 'event',
    match_type: partial.match_type ?? null,
    opponent: partial.opponent ?? null,
    is_home: partial.is_home ?? true,
    location: partial.location ?? 'Sporthalle Mitte',
    address: partial.address ?? null,
    starts_at: partial.starts_at,
    meeting_at: partial.meeting_at ?? null,
    status: partial.status ?? 'upcoming',
    attendance_mode: partial.attendance_mode ?? 'opt_in',
    notes: partial.notes ?? null,
    match_id: partial.match_id ?? null,
    series_id: partial.series_id ?? null,
    training_absence_deadline_disabled: partial.training_absence_deadline_disabled ?? null,
    created_by: partial.created_by ?? null,
    created_at: partial.created_at ?? null,
    updated_at: partial.updated_at ?? null,
  });

  const todayMatchStart = new Date(now);
  todayMatchStart.setHours(18, 30, 0, 0);
  const tomorrowTrain = new Date(now);
  tomorrowTrain.setDate(tomorrowTrain.getDate() + 1);
  tomorrowTrain.setHours(17, 0, 0, 0);

  const gameToday = mk({
    id: '00000000-0000-4000-8000-000000000010',
    kind: 'match',
    starts_at: todayMatchStart.toISOString(),
    opponent: 'SV Musterhausen',
    is_home: true,
    meeting_at: (() => {
      const m = new Date(todayMatchStart);
      m.setHours(17, 15, 0, 0);
      return m.toISOString();
    })(),
    location: 'Heimhalle Nord',
  });

  const trainingTomorrow = mk({
    id: '00000000-0000-4000-8000-000000000011',
    kind: 'training',
    starts_at: tomorrowTrain.toISOString(),
    location: 'Kunstrasen Platz 2',
  });

  const messages: HomeMessage[] = [
    {
      id: '00000000-0000-4000-8000-000000000020',
      title: 'Wichtig: Trikot mitbringen',
      body: 'Bitte das rote Heimtrikot für das Pokalspiel nicht vergessen. Treffen wir uns wie besprochen vorher in der Kabine.',
      content: null,
      created_at: new Date(now.getTime() - 3 * 3600000).toISOString(),
    },
  ];

  return {
    events: [gameToday, trainingTomorrow],
    messages,
    attendance: {
      openReminder: {
        event: gameToday,
        unansweredChildren: 4,
      },
    },
    now,
  };
}
