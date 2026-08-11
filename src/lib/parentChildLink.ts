/**
 * Eltern-Kind: Rollen-Metadata, Skip und sichere Verknüpfung (Einladungscode).
 * Keine offenen Kaderlisten, keine clientseitigen player_guardians-Inserts.
 */

import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

/** user_metadata-Flag: Onboarding ohne Kind abgeschlossen (kein player_guardians-Eintrag). */
export const PARENT_LINK_DEFERRED_META_KEY = 'parent_link_deferred';

/** user_metadata-Flag: Elternrolle bewusst gewählt (vor Membership / Kind-Verknüpfung). */
export const PARENT_ROLE_CHOSEN_META_KEY = 'parent_role_chosen';

export function isParentLinkDeferred(user: User | null | undefined): boolean {
  if (!user) return false;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return meta?.[PARENT_LINK_DEFERRED_META_KEY] === true;
}

export function isParentRoleChosen(user: User | null | undefined): boolean {
  if (!user) return false;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return meta?.[PARENT_ROLE_CHOSEN_META_KEY] === true;
}

/**
 * UI-Rolle „parent“ für Nutzer ohne Membership: gewählte Elternrolle oder verschobene Verknüpfung.
 * deferred allein impliziert Eltern-Onboarding (Self-Healing für fehlerhafte Testkonten).
 */
export function resolveParentUiRole(user: User | null | undefined): 'parent' | null {
  if (!user) return null;
  if (isParentRoleChosen(user) || isParentLinkDeferred(user)) return 'parent';
  return null;
}

export async function persistParentRoleChoice(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    data: { [PARENT_ROLE_CHOSEN_META_KEY]: true },
  });
  return { error: error?.message ?? null };
}

export async function setParentLinkDeferred(deferred: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    data: { [PARENT_LINK_DEFERRED_META_KEY]: deferred },
  });
  return { error: error?.message ?? null };
}

export async function clearParentLinkDeferred(): Promise<{ error: string | null }> {
  return setParentLinkDeferred(false);
}

export async function userHasPlayerGuardian(userId: string): Promise<{
  hasGuardian: boolean;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('player_guardians')
    .select('player_id')
    .eq('user_id', userId)
    .limit(1);
  if (error) return { hasGuardian: false, error: error.message };
  return { hasGuardian: (data ?? []).length > 0, error: null };
}

export type LinkedChildOption = {
  playerId: string;
  displayName: string;
  teamSeasonId: string | null;
  teamLabel: string | null;
};

export async function listMyLinkedChildren(): Promise<{
  data: LinkedChildOption[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('list_my_linked_children');
  if (error) {
    // Fallback: nur eigene Guardians ohne fremde Kader
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return { data: [], error: error.message };

    const { data: rows, error: gErr } = await supabase
      .from('player_guardians')
      .select('player_id')
      .eq('user_id', uid);
    if (gErr) return { data: [], error: gErr.message };

    const ids = (rows ?? []).map((r: { player_id: string }) => r.player_id);
    if (ids.length === 0) return { data: [], error: null };

    const { data: players, error: pErr } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .in('id', ids);
    if (pErr) return { data: [], error: pErr.message };

    return {
      data: (players ?? []).map(
        (p: { id: string; first_name?: string | null; last_name?: string | null }) => ({
          playerId: p.id,
          displayName:
            `${(p.first_name ?? '').toString().trim()} ${(p.last_name ?? '').toString().trim()}`.trim() ||
            'Kind',
          teamSeasonId: null,
          teamLabel: null,
        }),
      ),
      error: null,
    };
  }

  return {
    data: ((data ?? []) as Array<{
      player_id: string;
      display_name?: string | null;
      team_season_id?: string | null;
      team_label?: string | null;
    }>).map((row) => ({
      playerId: String(row.player_id),
      displayName: String(row.display_name ?? '').trim() || 'Kind',
      teamSeasonId: row.team_season_id ? String(row.team_season_id) : null,
      teamLabel: row.team_label ? String(row.team_label).trim() : null,
    })),
    error: null,
  };
}

export type RedeemParentInviteStatus =
  | 'linked'
  | 'already_linked'
  | 'invalid_token'
  | 'expired'
  | 'revoked'
  | 'already_used'
  | 'player_not_in_team'
  | 'not_authenticated'
  | 'error';

export type RedeemParentInviteResult = {
  status: RedeemParentInviteStatus;
  playerId: string | null;
  teamSeasonId: string | null;
  playerDisplayName: string | null;
  message: string | null;
};

function redeemMessage(status: RedeemParentInviteStatus): string {
  switch (status) {
    case 'linked':
      return 'Kind erfolgreich verknüpft.';
    case 'already_linked':
      return 'Dieses Kind ist bereits mit deinem Konto verknüpft.';
    case 'invalid_token':
      return 'Einladungscode ungültig.';
    case 'expired':
      return 'Diese Einladung ist abgelaufen. Bitte den Trainer um einen neuen Code.';
    case 'revoked':
      return 'Diese Einladung wurde widerrufen.';
    case 'already_used':
      return 'Diese Einladung wurde bereits verwendet.';
    case 'player_not_in_team':
      return 'Das Kind ist aktuell keinem aktiven Kader zugeordnet.';
    case 'not_authenticated':
      return 'Bitte erneut anmelden.';
    default:
      return 'Verknüpfung fehlgeschlagen.';
  }
}

/** Normalisiert Eltern-Einladungscode (48 hex). Spieler-Login-Codes werden nicht akzeptiert. */
export function normalizeParentInviteToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '');
}

export function isParentInviteTokenShape(token: string): boolean {
  return /^[0-9a-f]{48}$/.test(token);
}

export async function redeemParentLinkInvite(rawToken: string): Promise<RedeemParentInviteResult> {
  const token = normalizeParentInviteToken(rawToken);
  if (!isParentInviteTokenShape(token)) {
    return {
      status: 'invalid_token',
      playerId: null,
      teamSeasonId: null,
      playerDisplayName: null,
      message: redeemMessage('invalid_token'),
    };
  }

  const { data, error } = await supabase.rpc('redeem_parent_link_invite', { p_token: token });
  if (error) {
    return {
      status: 'error',
      playerId: null,
      teamSeasonId: null,
      playerDisplayName: null,
      message: 'Verknüpfung fehlgeschlagen.',
    };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const statusRaw = String(row.status ?? 'error');
  const allowed: RedeemParentInviteStatus[] = [
    'linked',
    'already_linked',
    'invalid_token',
    'expired',
    'revoked',
    'already_used',
    'player_not_in_team',
    'not_authenticated',
    'error',
  ];
  const status = (allowed.includes(statusRaw as RedeemParentInviteStatus)
    ? statusRaw
    : 'error') as RedeemParentInviteStatus;

  return {
    status,
    playerId: row.player_id != null ? String(row.player_id) : null,
    teamSeasonId: row.team_season_id != null ? String(row.team_season_id) : null,
    playerDisplayName:
      row.player_display_name != null ? String(row.player_display_name).trim() || null : null,
    message: redeemMessage(status),
  };
}

/** Gate-Logik: Eltern mit Guardian oder Skip gelten als onboarding-fertig. */
export function isParentOnboardingSatisfied(opts: {
  hasGuardian: boolean;
  hasParentMembership: boolean;
  deferred: boolean;
  previewIsParent: boolean;
  backendIsParent: boolean;
  parentRoleChosen?: boolean;
}): { complete: boolean; needsOnboardingUi: boolean } {
  if (opts.hasGuardian) {
    return { complete: true, needsOnboardingUi: false };
  }
  if (opts.deferred) {
    return { complete: true, needsOnboardingUi: false };
  }
  const looksLikeParent =
    opts.previewIsParent ||
    opts.backendIsParent ||
    opts.hasParentMembership ||
    opts.parentRoleChosen === true;
  if (looksLikeParent) {
    return { complete: false, needsOnboardingUi: true };
  }
  return { complete: true, needsOnboardingUi: false };
}
