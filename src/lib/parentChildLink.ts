/**
 * Eltern-Kind: Rollen-Metadata, Skip, Self-Service-Auswahl und sichere Verknüpfung.
 * Keine clientseitigen player_guardians-Inserts — Listing und Link nur per RPC.
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

export type ParentOnboardingClubOption = {
  id: string;
  name: string;
};

export type ParentOnboardingTeamOption = {
  id: string;
  label: string;
};

export type ParentOnboardingSeasonOption = {
  id: string;
  label: string;
  status: string | null;
};

export type ParentOnboardingPlayerOption = {
  id: string;
  display_name: string;
  jersey_number: number | null;
};

export async function listParentOnboardingClubs(): Promise<{
  data: ParentOnboardingClubOption[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('list_parent_onboarding_clubs');
  if (error) return { data: [], error: error.message };
  return {
    data: ((data ?? []) as Array<{ id: string; name?: string | null }>).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? '').trim() || 'Verein',
    })),
    error: null,
  };
}

export async function listParentOnboardingTeams(clubId: string): Promise<{
  data: ParentOnboardingTeamOption[];
  error: string | null;
}> {
  const cid = clubId?.trim();
  if (!cid) return { data: [], error: 'Kein Verein gewählt.' };
  const { data, error } = await supabase.rpc('list_parent_onboarding_teams', { p_club_id: cid });
  if (error) return { data: [], error: error.message };
  return {
    data: ((data ?? []) as Array<{ id: string; label?: string | null }>).map((row) => ({
      id: String(row.id),
      label: String(row.label ?? '').trim() || 'Mannschaft',
    })),
    error: null,
  };
}

export async function listParentOnboardingSeasons(teamId: string): Promise<{
  data: ParentOnboardingSeasonOption[];
  error: string | null;
}> {
  const tid = teamId?.trim();
  if (!tid) return { data: [], error: 'Keine Mannschaft gewählt.' };
  const { data, error } = await supabase.rpc('list_parent_onboarding_seasons', { p_team_id: tid });
  if (error) return { data: [], error: error.message };
  return {
    data: ((data ?? []) as Array<{
      id: string;
      label?: string | null;
      status?: string | null;
    }>).map((row) => ({
      id: String(row.id),
      label: String(row.label ?? '').trim() || 'Saison',
      status: row.status != null ? String(row.status) : null,
    })),
    error: null,
  };
}

export async function listParentOnboardingRoster(teamSeasonId: string): Promise<{
  data: ParentOnboardingPlayerOption[];
  error: string | null;
}> {
  const sid = teamSeasonId?.trim();
  if (!sid) return { data: [], error: 'Keine Saison gewählt.' };
  const { data, error } = await supabase.rpc('list_parent_onboarding_roster', {
    p_team_season_id: sid,
  });
  if (error) return { data: [], error: error.message };
  return {
    data: ((data ?? []) as Array<{
      id: string;
      display_name?: string | null;
      jersey_number?: number | null;
    }>).map((row) => ({
      id: String(row.id),
      display_name: String(row.display_name ?? '').trim() || 'Spieler',
      jersey_number: row.jersey_number != null ? Number(row.jersey_number) : null,
    })),
    error: null,
  };
}

export type LinkParentSelfServiceStatus =
  | 'linked'
  | 'already_linked'
  | 'player_not_in_team'
  | 'not_authenticated'
  | 'invalid_input'
  | 'forbidden'
  | 'error';

export type LinkParentSelfServiceResult = {
  status: LinkParentSelfServiceStatus;
  playerId: string | null;
  teamSeasonId: string | null;
  playerDisplayName: string | null;
  message: string | null;
};

function linkSelfServiceMessage(status: LinkParentSelfServiceStatus): string {
  switch (status) {
    case 'linked':
      return 'Kind erfolgreich verknüpft.';
    case 'already_linked':
      return 'Dieses Kind ist bereits mit deinem Konto verknüpft.';
    case 'player_not_in_team':
      return 'Das Kind ist aktuell keinem aktiven Kader zugeordnet.';
    case 'not_authenticated':
      return 'Bitte erneut anmelden.';
    case 'forbidden':
      return 'Diese Auswahl ist derzeit nicht verfügbar.';
    case 'invalid_input':
      return 'Bitte Verein, Mannschaft, Saison und Kind auswählen.';
    default:
      return 'Verknüpfung fehlgeschlagen.';
  }
}

export async function linkParentSelfService(
  teamSeasonId: string,
  playerId: string,
): Promise<LinkParentSelfServiceResult> {
  const { data, error } = await supabase.rpc('link_parent_self_service', {
    p_team_season_id: teamSeasonId.trim(),
    p_player_id: playerId.trim(),
  });
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
  const allowed: LinkParentSelfServiceStatus[] = [
    'linked',
    'already_linked',
    'player_not_in_team',
    'not_authenticated',
    'invalid_input',
    'forbidden',
    'error',
  ];
  const status = (allowed.includes(statusRaw as LinkParentSelfServiceStatus)
    ? statusRaw
    : 'error') as LinkParentSelfServiceStatus;

  return {
    status,
    playerId: row.player_id != null ? String(row.player_id) : null,
    teamSeasonId: row.team_season_id != null ? String(row.team_season_id) : null,
    playerDisplayName:
      row.player_display_name != null ? String(row.player_display_name).trim() || null : null,
    message: linkSelfServiceMessage(status),
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
  | 'email_mismatch'
  | 'email_not_verified'
  | 'error';

export type RedeemParentInviteResult = {
  status: RedeemParentInviteStatus;
  playerId: string | null;
  teamSeasonId: string | null;
  playerDisplayName: string | null;
  expectedEmailMasked: string | null;
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
    case 'email_mismatch':
      return 'Diese Einladung gilt für eine andere E-Mail-Adresse.';
    case 'email_not_verified':
      return 'Bitte zuerst die E-Mail-Adresse bestätigen.';
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
      expectedEmailMasked: null,
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
      expectedEmailMasked: null,
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
    'email_mismatch',
    'email_not_verified',
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
    expectedEmailMasked:
      row.expected_email_masked != null ? String(row.expected_email_masked) : null,
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
