import type { SupabaseClient } from '@supabase/supabase-js';
import { dedupeRecipientUserIds } from './pending';

/**
 * Spieler-IDs dieses Users, die im Kader dieser team_season sind (Guardian + player_users).
 * Kader: team_season_players (Fallback: players.team_season_id).
 */
export async function fetchPlayerIdsForUserInTeamSeason(
  admin: SupabaseClient,
  userId: string,
  teamSeasonId: string,
): Promise<string[]> {
  let rosterIds = new Set<string>();

  const { data: joinRows, error: joinErr } = await admin
    .from('team_season_players')
    .select('player_id')
    .eq('team_season_id', teamSeasonId)
    .is('left_at', null);

  if (!joinErr && joinRows && joinRows.length > 0) {
    rosterIds = new Set(
      (joinRows as Array<{ player_id: string }>).map((r) => r.player_id).filter(Boolean),
    );
  } else {
    // Compat / Tabelle fehlt / leer
    const { data: players, error: pErr } = await admin
      .from('players')
      .select('id')
      .eq('team_season_id', teamSeasonId)
      .eq('is_active', true);
    if (pErr) throw pErr;
    rosterIds = new Set((players ?? []).map((p: { id: string }) => p.id));
  }

  const { data: g, error: gErr } = await admin
    .from('player_guardians')
    .select('player_id')
    .eq('user_id', userId);
  if (gErr) throw gErr;
  const fromG = (g ?? [])
    .map((x: { player_id: string }) => x.player_id)
    .filter((id: string) => rosterIds.has(id));

  const { data: pu, error: puErr } = await admin.from('player_users').select('player_id').eq('user_id', userId);
  if (puErr) throw puErr;
  const fromPu = (pu ?? [])
    .map((x: { player_id: string }) => x.player_id)
    .filter((id: string) => rosterIds.has(id));

  return Array.from(new Set([...fromG, ...fromPu]));
}

/** Rollen, die zeitbasierte Termin-Erinnerungen erhalten (wie Edge send-reminders). */
const REMINDER_TEAM_ROLES = ['trainer', 'co_trainer', 'head_coach', 'parent', 'player'] as const;

/**
 * Empfänger für Erinnerungs-Jobs: Trainer + Eltern + Spieler (kein Fan).
 * Nicht mit Teilnahme-/Kader-Filtern eingeschränkt — das ist Absicht (Push/In-App „Termin steht an“).
 */
export async function fetchReminderRecipientUserIdsForTeamSeason(
  admin: SupabaseClient,
  teamSeasonId: string,
): Promise<string[]> {
  const { data: rpcRows, error: rpcErr } = await admin.rpc('distinct_reminder_recipient_user_ids', {
    p_team_season_id: teamSeasonId,
  });

  let ids: string[] = [];
  if (rpcErr) {
    console.warn('[notificationsDedup] distinct_reminder_recipient_user_ids RPC failed, fallback memberships', {
      teamSeasonId,
      message: rpcErr.message,
    });
    const { data: members, error } = await admin
      .from('memberships')
      .select('user_id')
      .eq('team_season_id', teamSeasonId)
      .in('role', [...REMINDER_TEAM_ROLES]);
    if (error) throw error;
    ids = (members ?? []).map((m: { user_id: string }) => m.user_id).filter(Boolean);
  } else {
    const rows = (rpcRows ?? []) as Array<{ user_id?: string | null }>;
    ids = rows.map((r) => r.user_id).filter((id): id is string => Boolean(id));
  }

  const fromQueryCount = ids.length;
  const out = dedupeRecipientUserIds(ids);
  console.log('[notificationsDedup] recipients from memberships', {
    teamSeasonId,
    rowOrDistinctCount: fromQueryCount,
    afterClientDedupe: out.length,
  });
  return out;
}

/** User mit Membership parent/player für diese Saison (Legacy: nur Parent/Spieler). */
export async function fetchRecipientUserIdsForTeamSeason(
  admin: SupabaseClient,
  teamSeasonId: string,
): Promise<string[]> {
  const { data: members, error } = await admin
    .from('memberships')
    .select('user_id')
    .eq('team_season_id', teamSeasonId)
    .in('role', ['parent', 'player']);
  if (error) throw error;
  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  return Array.from(new Set(ids));
}

/** Nur Spieler-Mitgliedschaft (Push-Automationen). */
export async function fetchPlayerUserIdsForTeamSeason(
  admin: SupabaseClient,
  teamSeasonId: string,
): Promise<string[]> {
  const { data: members, error } = await admin
    .from('memberships')
    .select('user_id')
    .eq('team_season_id', teamSeasonId)
    .eq('role', 'player');
  if (error) throw error;
  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  return Array.from(new Set(ids));
}
