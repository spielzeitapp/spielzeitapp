/**
 * Trainer: einmalige Eltern-Einladungscodes (getrennt von Spieler-Code/PIN/QR).
 */

import { supabase } from './supabaseClient';

export type ParentInviteState = 'open' | 'used' | 'revoked' | 'expired';

export type ParentInviteInfo = {
  id: string;
  createdAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  usedAt: string | null;
  state: ParentInviteState;
};

export type CreateParentInviteResult = {
  status: 'created' | 'forbidden' | 'invalid_input' | 'player_not_in_team' | 'not_authenticated' | 'error';
  inviteId: string | null;
  tokenPlain: string | null;
  expiresAt: string | null;
  message: string | null;
};

function asRecord(data: unknown): Record<string, unknown> {
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

export async function createParentLinkInvite(input: {
  teamSeasonId: string;
  playerId: string;
  expiresHours?: number;
}): Promise<CreateParentInviteResult> {
  const { data, error } = await supabase.rpc('create_parent_link_invite', {
    p_team_season_id: input.teamSeasonId,
    p_player_id: input.playerId,
    p_expires_hours: input.expiresHours ?? 72,
  });

  if (error) {
    return {
      status: 'error',
      inviteId: null,
      tokenPlain: null,
      expiresAt: null,
      message: 'Einladung konnte nicht erstellt werden.',
    };
  }

  const row = asRecord(data);
  const status = String(row.status ?? 'error');
  if (status !== 'created') {
    const messages: Record<string, string> = {
      forbidden: 'Keine Berechtigung für diese Einladung.',
      invalid_input: 'Ungültige Eingabe.',
      player_not_in_team: 'Spieler ist nicht im aktiven Kader.',
      not_authenticated: 'Bitte erneut anmelden.',
    };
    return {
      status: (status as CreateParentInviteResult['status']) || 'error',
      inviteId: null,
      tokenPlain: null,
      expiresAt: null,
      message: messages[status] ?? 'Einladung konnte nicht erstellt werden.',
    };
  }

  return {
    status: 'created',
    inviteId: row.invite_id != null ? String(row.invite_id) : null,
    tokenPlain: row.token_plain != null ? String(row.token_plain) : null,
    expiresAt: row.expires_at != null ? String(row.expires_at) : null,
    message: null,
  };
}

export async function revokeParentLinkInvite(inviteId: string): Promise<{
  status: string;
  message: string | null;
}> {
  const { data, error } = await supabase.rpc('revoke_parent_link_invite', {
    p_invite_id: inviteId,
  });
  if (error) {
    return { status: 'error', message: 'Widerruf fehlgeschlagen.' };
  }
  const status = String(asRecord(data).status ?? 'error');
  if (status === 'revoked') return { status, message: null };
  if (status === 'already_used') return { status, message: 'Einladung wurde bereits verwendet.' };
  if (status === 'already_revoked') return { status, message: 'Einladung war bereits widerrufen.' };
  if (status === 'forbidden') return { status, message: 'Keine Berechtigung.' };
  if (status === 'not_found') return { status, message: 'Einladung nicht gefunden.' };
  return { status, message: 'Widerruf fehlgeschlagen.' };
}

export async function listParentLinkInvitesForPlayer(input: {
  teamSeasonId: string;
  playerId: string;
}): Promise<{ invites: ParentInviteInfo[]; error: string | null }> {
  const { data, error } = await supabase.rpc('list_parent_link_invites_for_player', {
    p_team_season_id: input.teamSeasonId,
    p_player_id: input.playerId,
  });
  if (error) return { invites: [], error: error.message };

  const row = asRecord(data);
  if (String(row.status) !== 'ok') {
    return { invites: [], error: null };
  }

  const raw = Array.isArray(row.invites) ? row.invites : [];
  const invites: ParentInviteInfo[] = raw.map((item) => {
    const r = asRecord(item);
    const stateRaw = String(r.state ?? 'open');
    const state: ParentInviteState =
      stateRaw === 'used' || stateRaw === 'revoked' || stateRaw === 'expired' || stateRaw === 'open'
        ? stateRaw
        : 'open';
    return {
      id: String(r.id),
      createdAt: r.created_at != null ? String(r.created_at) : null,
      expiresAt: r.expires_at != null ? String(r.expires_at) : null,
      revokedAt: r.revoked_at != null ? String(r.revoked_at) : null,
      usedAt: r.used_at != null ? String(r.used_at) : null,
      state,
    };
  });

  return { invites, error: null };
}

export function parentInviteStateLabel(state: ParentInviteState): string {
  switch (state) {
    case 'open':
      return 'Offen';
    case 'used':
      return 'Verwendet';
    case 'revoked':
      return 'Widerrufen';
    case 'expired':
      return 'Abgelaufen';
  }
}
