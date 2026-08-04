/**
 * Feed-Notices für Meisterschaftsspielplan (STEP 7B.4.2).
 * Keine Migration: post_kind / media_type sind freies text.
 * Kein Push hier — nur team_feed_posts (keine Flut).
 */
import { supabase } from './supabaseClient';
import { normalizeOpponentKey } from './teamVenues';
import { isViennaPlaceholderKickoff, utcIsoToViennaTimeHHmm } from './viennaTime';
import { safeText } from './safeText';

export const CHAMPIONSHIP_SCHEDULE_POST_KIND = 'championship_schedule_published';
export const CHAMPIONSHIP_SCHEDULE_MEDIA_TYPE = 'championship_schedule';
export const CHAMPIONSHIP_MATCH_CHANGED_POST_KIND = 'championship_match_changed';
export const CHAMPIONSHIP_MATCH_CHANGED_MEDIA_TYPE = 'championship_match_changed';

export const CHAMPIONSHIP_SCHEDULE_DEEP_LINK = '/app/spielplan';

export type ChampionshipMaterialSnapshot = {
  starts_at: string;
  meeting_at: string | null;
  venue_id: string | null;
  location: string | null;
  opponent: string | null;
  is_home: boolean | null;
};

export type ChampionshipScheduleFeedPayload = {
  team_season_id: string;
  age_group: string | null;
  season_name: string | null;
  published_count: number;
  deep_link: string;
};

export type ChampionshipMatchChangedFeedPayload = {
  event_id: string;
  encounter: string;
  starts_at: string;
  meeting_at: string | null;
  location: string | null;
  is_home: boolean;
  opponent: string | null;
  our_team_name: string;
  deep_link: string;
  change_fingerprint: string;
};

export function championshipSchedulePublishedDedupeKey(teamSeasonId: string): string {
  return `championship_schedule_published:${teamSeasonId.trim()}`;
}

export function championshipMatchChangedDedupeKey(eventId: string, fingerprint: string): string {
  return `championship_match_changed:${eventId.trim()}:${fingerprint}`;
}

export function materialFingerprint(snap: ChampionshipMaterialSnapshot): string {
  const starts = String(snap.starts_at ?? '').trim();
  const meeting = String(snap.meeting_at ?? '').trim();
  const venue = String(snap.venue_id ?? '').trim();
  const loc = String(snap.location ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const opp = normalizeOpponentKey(snap.opponent) || String(snap.opponent ?? '').trim().toLowerCase();
  const home = snap.is_home === true ? '1' : snap.is_home === false ? '0' : '';
  return [starts, meeting, venue, loc, opp, home].join('|');
}

export function hasMaterialChampionshipChange(
  before: ChampionshipMaterialSnapshot,
  after: ChampionshipMaterialSnapshot,
): boolean {
  return materialFingerprint(before) !== materialFingerprint(after);
}

export function parseChampionshipSchedulePayload(
  raw: unknown,
): ChampionshipScheduleFeedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.team_season_id !== 'string' || !p.team_season_id.trim()) return null;
  return {
    team_season_id: p.team_season_id,
    age_group: typeof p.age_group === 'string' ? p.age_group : null,
    season_name: typeof p.season_name === 'string' ? p.season_name : null,
    published_count: typeof p.published_count === 'number' ? p.published_count : 0,
    deep_link:
      typeof p.deep_link === 'string' && p.deep_link.trim()
        ? p.deep_link
        : CHAMPIONSHIP_SCHEDULE_DEEP_LINK,
  };
}

export function parseChampionshipMatchChangedPayload(
  raw: unknown,
): ChampionshipMatchChangedFeedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.event_id !== 'string' || !p.event_id.trim()) return null;
  if (typeof p.starts_at !== 'string' || !p.starts_at.trim()) return null;
  return {
    event_id: p.event_id,
    encounter: typeof p.encounter === 'string' ? p.encounter : '',
    starts_at: p.starts_at,
    meeting_at: typeof p.meeting_at === 'string' ? p.meeting_at : null,
    location: typeof p.location === 'string' ? p.location : null,
    is_home: Boolean(p.is_home),
    opponent: typeof p.opponent === 'string' ? p.opponent : null,
    our_team_name: typeof p.our_team_name === 'string' ? p.our_team_name : '',
    deep_link:
      typeof p.deep_link === 'string' && p.deep_link.trim()
        ? p.deep_link
        : `/app/events/${p.event_id}`,
    change_fingerprint: typeof p.change_fingerprint === 'string' ? p.change_fingerprint : '',
  };
}

function formatKickoffLongDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  if (isViennaPlaceholderKickoff(iso)) {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: 'Europe/Vienna',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  }
  const datePart = new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
  const time = utcIsoToViennaTimeHHmm(iso) || '';
  return time ? `${datePart} · ${time}` : datePart;
}

export function buildChampionshipScheduleCaption(opts: {
  ageGroup?: string | null;
  seasonName?: string | null;
}): string {
  const parts = [safeText(opts.ageGroup), safeText(opts.seasonName)].filter(Boolean);
  const label = parts.length > 0 ? parts.join(' · ') : 'diese Saison';
  return [
    '📅 Meisterschaftsspielplan veröffentlicht',
    '',
    `Der Meisterschaftsspielplan für ${label} ist jetzt verfügbar.`,
  ].join('\n');
}

export function buildChampionshipMatchChangedCaption(opts: {
  encounter: string;
  startsAt: string;
  meetingAt: string | null;
  location: string | null;
}): string {
  const lines = [
    '⚠️ Spieltermin geändert',
    '',
    opts.encounter,
    '',
    'Neuer Termin:',
    formatKickoffLongDe(opts.startsAt),
  ];
  if (opts.meetingAt) {
    lines.push('', 'Treffpunkt:', utcIsoToViennaTimeHHmm(opts.meetingAt) || '–');
  }
  const loc = safeText(opts.location);
  if (loc) {
    lines.push('', 'Spielort:', loc);
  }
  return lines.join('\n');
}

async function resolveTeamId(teamSeasonId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_seasons')
    .select('team_id')
    .eq('id', teamSeasonId)
    .maybeSingle();
  if (error || !data?.team_id) return null;
  return String(data.team_id);
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function hasChampionshipScheduleFeedPost(
  teamSeasonId: string,
): Promise<boolean> {
  const dedupeKey = championshipSchedulePublishedDedupeKey(teamSeasonId);
  const { data, error } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

async function isFeedDedupeSuppressed(dedupeKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_feed_dedupe_suppressions')
    .select('dedupe_key')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  if (error) {
    // Ohne Migration/SELECT-Recht: lieber nicht blockieren als false-positive.
    console.warn('[championshipScheduleFeed] suppressions lookup', error.message);
    return false;
  }
  return Boolean(data?.dedupe_key);
}

async function countPublishedChampionshipFixtures(teamSeasonId: string): Promise<number> {
  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('team_season_id', teamSeasonId)
    .eq('external_source', 'oefb')
    .eq('fixture_status', 'published');
  if (error) return 0;
  return count ?? 0;
}

/**
 * Genau ein Sammel-Post, wenn erstmals ≥2 published Spiele existieren
 * und noch kein Schedule-Post für die Saison existiert.
 * Kein Feed bei ÖFB-Import / open / agreed.
 */
export async function maybePublishChampionshipScheduleFeed(opts: {
  teamSeasonId: string;
  ageGroup?: string | null;
  seasonName?: string | null;
}): Promise<{ posted: boolean; reason: string }> {
  const already = await hasChampionshipScheduleFeedPost(opts.teamSeasonId);
  if (already) return { posted: false, reason: 'already_announced' };

  const suppressed = await isFeedDedupeSuppressed(
    championshipSchedulePublishedDedupeKey(opts.teamSeasonId),
  );
  if (suppressed) return { posted: false, reason: 'suppressed' };

  const publishedCount = await countPublishedChampionshipFixtures(opts.teamSeasonId);
  if (publishedCount < 2) {
    return { posted: false, reason: 'need_multiple_published' };
  }

  const teamId = await resolveTeamId(opts.teamSeasonId);
  if (!teamId) return { posted: false, reason: 'missing_team' };

  const userId = await currentUserId();
  const payload: ChampionshipScheduleFeedPayload = {
    team_season_id: opts.teamSeasonId,
    age_group: opts.ageGroup?.trim() || null,
    season_name: opts.seasonName?.trim() || null,
    published_count: publishedCount,
    deep_link: CHAMPIONSHIP_SCHEDULE_DEEP_LINK,
  };

  const { error } = await supabase.from('team_feed_posts').insert({
    team_season_id: opts.teamSeasonId,
    team_id: teamId,
    event_id: null,
    post_kind: CHAMPIONSHIP_SCHEDULE_POST_KIND,
    caption: buildChampionshipScheduleCaption({
      ageGroup: opts.ageGroup,
      seasonName: opts.seasonName,
    }),
    payload,
    dedupe_key: championshipSchedulePublishedDedupeKey(opts.teamSeasonId),
    media_type: CHAMPIONSHIP_SCHEDULE_MEDIA_TYPE,
    media_url: null,
    thumbnail_url: null,
    duration_seconds: null,
    created_by: userId,
  });

  if (error) {
    if (error.code === '23505') return { posted: false, reason: 'already_announced' };
    return { posted: false, reason: error.message };
  }
  return { posted: true, reason: 'ok' };
}

/**
 * Änderungs-Feed nur bei wesentlicher Differenz eines published Spiels.
 * Dedup über Fingerprint der neuen Materialwerte.
 */
export async function maybePublishChampionshipMatchChangedFeed(opts: {
  teamSeasonId: string;
  eventId: string;
  before: ChampionshipMaterialSnapshot;
  after: ChampionshipMaterialSnapshot;
  ourTeamName: string;
}): Promise<{ posted: boolean; reason: string }> {
  if (!hasMaterialChampionshipChange(opts.before, opts.after)) {
    return { posted: false, reason: 'no_material_change' };
  }

  const fingerprint = materialFingerprint(opts.after);
  const dedupeKey = championshipMatchChangedDedupeKey(opts.eventId, fingerprint);

  if (await isFeedDedupeSuppressed(dedupeKey)) {
    return { posted: false, reason: 'suppressed' };
  }

  const { data: existing } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  if (existing?.id) return { posted: false, reason: 'duplicate_change' };

  const teamId = await resolveTeamId(opts.teamSeasonId);
  if (!teamId) return { posted: false, reason: 'missing_team' };

  const ourTeamName = safeText(opts.ourTeamName) || 'Heim';
  const them = safeText(opts.after.opponent) || 'Gegner';
  const encounter =
    opts.after.is_home === true ? `${ourTeamName} – ${them}` : `${them} – ${ourTeamName}`;

  const payload: ChampionshipMatchChangedFeedPayload = {
    event_id: opts.eventId,
    encounter,
    starts_at: opts.after.starts_at,
    meeting_at: opts.after.meeting_at,
    location: opts.after.location,
    is_home: opts.after.is_home === true,
    opponent: opts.after.opponent,
    our_team_name: ourTeamName,
    deep_link: `/app/events/${opts.eventId}`,
    change_fingerprint: fingerprint,
  };

  const userId = await currentUserId();
  const { error } = await supabase.from('team_feed_posts').insert({
    team_season_id: opts.teamSeasonId,
    team_id: teamId,
    event_id: opts.eventId,
    post_kind: CHAMPIONSHIP_MATCH_CHANGED_POST_KIND,
    caption: buildChampionshipMatchChangedCaption({
      encounter,
      startsAt: opts.after.starts_at,
      meetingAt: opts.after.meeting_at,
      location: opts.after.location,
    }),
    payload,
    dedupe_key: dedupeKey,
    media_type: CHAMPIONSHIP_MATCH_CHANGED_MEDIA_TYPE,
    media_url: null,
    thumbnail_url: null,
    duration_seconds: null,
    created_by: userId,
  });

  if (error) {
    if (error.code === '23505') return { posted: false, reason: 'duplicate_change' };
    return { posted: false, reason: error.message };
  }
  return { posted: true, reason: 'ok' };
}
