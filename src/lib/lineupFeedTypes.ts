import { FEED_HASHTAG } from '../components/feed/feedTypography';
import type { FieldSlotId } from '../types/match';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from './viennaTime';

export type LineupFeedPlayer = {
  player_id: string;
  /** @deprecated Legacy alias — use playerName */
  name: string;
  playerName: string;
  /** Feld-Slot: GK, LB, RB, CM, LW, RW, ST */
  slot?: string;
  /** Lesbares Positionslabel für Eltern/Fans */
  positionLabel?: string;
};

export type LineupFeedPayload = {
  match_id: string;
  event_id: string;
  team_season_id: string;
  formation: string | null;
  lineup_players: LineupFeedPlayer[];
  starts_at?: string | null;
  deep_link?: string;
};

export const LINEUP_FEED_FIELD_SLOT_LABELS: Record<FieldSlotId, string> = {
  GK: 'Torwart',
  LB: 'Linksverteidiger',
  RB: 'Rechtsverteidiger',
  CM: 'Zentrum',
  LW: 'Links außen',
  RW: 'Rechts außen',
  ST: 'Sturm',
};

const LINEUP_POSITION_ABBREVS = new Set([
  'GK',
  'TW',
  'LB',
  'LV',
  'RB',
  'RV',
  'CM',
  'ZM',
  'IV',
  'LW',
  'LA',
  'LM',
  'LZ',
  'LZM',
  'LF',
  'RW',
  'RA',
  'RM',
  'RZM',
  'RF',
  'ST',
  'LS',
  'RS',
]);

export function lineupFeedFriendlyPositionLabel(fieldSlot: FieldSlotId): string {
  return LINEUP_FEED_FIELD_SLOT_LABELS[fieldSlot];
}

export function isLineupPositionAbbrev(value: string): boolean {
  const upper = value.trim().toUpperCase();
  return upper.length > 0 && LINEUP_POSITION_ABBREVS.has(upper);
}

/** Echter Spielername — niemals Positionskürzel oder Platzhalter. */
export function sanitizeLineupFeedPlayerName(
  rawName: string | null | undefined,
  slotOrLabel?: string | null,
): string {
  const trimmed = (rawName ?? '').trim();
  if (!trimmed || trimmed === 'Spieler') return '';
  const upper = trimmed.toUpperCase();
  if (isLineupPositionAbbrev(upper)) return '';
  const slotKey = (slotOrLabel ?? '').trim().toUpperCase();
  if (slotKey && upper === slotKey) return '';
  return trimmed;
}

export function lineupFeedDisplayPositionLabel(player: LineupFeedPlayer): string {
  const explicit = player.positionLabel?.trim();
  if (explicit) return explicit;
  const slotKey = (player.slot ?? '').trim().toUpperCase() as FieldSlotId;
  if (slotKey && LINEUP_FEED_FIELD_SLOT_LABELS[slotKey]) {
    return LINEUP_FEED_FIELD_SLOT_LABELS[slotKey];
  }
  if (player.slot && isLineupPositionAbbrev(player.slot)) {
    const mapped = LINEUP_POSITION_ABBREVS.has(player.slot.toUpperCase())
      ? ({
          GK: 'Torwart',
          TW: 'Torwart',
          LB: 'Linksverteidiger',
          LV: 'Linksverteidiger',
          RB: 'Rechtsverteidiger',
          RV: 'Rechtsverteidiger',
          CM: 'Zentrum',
          ZM: 'Zentrum',
          IV: 'Zentrum',
          LW: 'Links außen',
          LA: 'Links außen',
          LM: 'Links außen',
          LZ: 'Links außen',
          LZM: 'Links außen',
          LF: 'Links außen',
          RW: 'Rechts außen',
          RA: 'Rechts außen',
          RM: 'Rechts außen',
          RZM: 'Rechts außen',
          RF: 'Rechts außen',
          ST: 'Sturm',
          LS: 'Sturm',
          RS: 'Sturm',
        } as Record<string, string>)[player.slot.toUpperCase()]
      : undefined;
    if (mapped) return mapped;
  }
  return player.slot?.trim() || 'Position';
}

export function lineupFeedDisplayPlayerName(player: LineupFeedPlayer): string | null {
  const raw = player.playerName?.trim() || player.name?.trim() || '';
  const clean = sanitizeLineupFeedPlayerName(raw, player.slot);
  return clean || null;
}

export function dedupeKeyForLineupMatch(matchId: string): string {
  return `lineup_feed:${matchId.trim()}`;
}

function normalizeLineupFeedPlayerRow(row: Record<string, unknown>): LineupFeedPlayer | null {
  const player_id = typeof row.player_id === 'string' ? row.player_id.trim() : '';
  if (!player_id) return null;

  const rawName =
    (typeof row.playerName === 'string' ? row.playerName : '') ||
    (typeof row.name === 'string' ? row.name : '');
  const slot = typeof row.slot === 'string' ? row.slot.trim() : undefined;
  const positionLabel =
    typeof row.positionLabel === 'string' ? row.positionLabel.trim() : undefined;
  const playerName = sanitizeLineupFeedPlayerName(rawName, slot);

  return {
    player_id,
    playerName,
    name: playerName,
    slot,
    positionLabel: positionLabel || undefined,
  };
}

export function parseLineupFeedPayload(raw: unknown): LineupFeedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const matchId = typeof p.match_id === 'string' ? p.match_id.trim() : '';
  const eventId = typeof p.event_id === 'string' ? p.event_id.trim() : '';
  const teamSeasonId = typeof p.team_season_id === 'string' ? p.team_season_id.trim() : '';
  if (!matchId || !eventId || !teamSeasonId) return null;

  const rawPlayers = p.lineup_players;
  const lineup_players: LineupFeedPlayer[] = [];
  if (Array.isArray(rawPlayers)) {
    for (const item of rawPlayers) {
      if (!item || typeof item !== 'object') continue;
      const normalized = normalizeLineupFeedPlayerRow(item as Record<string, unknown>);
      if (normalized) lineup_players.push(normalized);
    }
  }

  const formationRaw = p.formation;
  const formation =
    formationRaw == null || formationRaw === ''
      ? null
      : typeof formationRaw === 'string'
        ? formationRaw.trim() || null
        : String(formationRaw).trim() || null;

  return {
    match_id: matchId,
    event_id: eventId,
    team_season_id: teamSeasonId,
    formation,
    lineup_players,
    starts_at: typeof p.starts_at === 'string' ? p.starts_at : null,
    deep_link: typeof p.deep_link === 'string' ? p.deep_link : undefined,
  };
}

function formatLineupKickoffTimeLine(startsAtIso: string): string {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = getDateTimePartsInTimeZone(d, VIENNA_TZ);
  if (!parts) return '—';
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')} Uhr`;
}

export function buildAutoLineupFeedCaption(params: {
  formation: string | null;
  startsAtIso: string;
}): string {
  const lines = ['📋 STARTAUFSTELLUNG', '', 'Unsere Mannschaft ist bereit.', ''];
  if (params.formation?.trim()) {
    lines.push(`Formation: ${params.formation.trim()}`, '');
  }
  lines.push(`⚽ Heute ${formatLineupKickoffTimeLine(params.startsAtIso)}`, '', FEED_HASHTAG);
  return lines.join('\n');
}
