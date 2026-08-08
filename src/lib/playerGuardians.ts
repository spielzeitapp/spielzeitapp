/**
 * Trainer: Elternaccount per exakter E-Mail mit Spieler verknüpfen.
 * Nutzt SECURITY-DEFINER-RPCs (kein Service-Role, keine Benutzerliste).
 */

import { supabase } from './supabaseClient';
import { isValidAccountEmail } from '../hooks/useTeamStaff';

export type GuardianLookupStatus =
  | 'found'
  | 'not_found'
  | 'invalid_email'
  | 'invalid_input'
  | 'forbidden'
  | 'player_not_in_team'
  | 'error';

export type GuardianLookupResult = {
  status: GuardianLookupStatus;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  message: string | null;
};

export type GuardianLinkStatus =
  | 'linked'
  | 'already_linked'
  | 'not_found'
  | 'invalid_input'
  | 'forbidden'
  | 'player_not_in_team'
  | 'error';

export type GuardianLinkResult = {
  status: GuardianLinkStatus;
  displayName: string | null;
  message: string | null;
};

export type GuardianUnlinkStatus =
  | 'unlinked'
  | 'not_linked'
  | 'invalid_input'
  | 'forbidden'
  | 'player_not_in_team'
  | 'error';

export type GuardianUnlinkResult = {
  status: GuardianUnlinkStatus;
  displayName: string | null;
  message: string | null;
};

export function normalizeGuardianEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function guardianDisplayLabel(
  displayName: string | null | undefined,
  email: string | null | undefined,
  fallback = 'Elternaccount',
): string {
  const name = displayName != null ? String(displayName).trim() : '';
  if (name.length > 0 && name.toLowerCase() !== 'null') return name;
  const mail = email != null ? String(email).trim() : '';
  if (mail.length > 0) return mail;
  return fallback;
}

function asRecord(data: unknown): Record<string, unknown> {
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

function statusOf(data: unknown): string {
  const s = asRecord(data).status;
  return s != null ? String(s) : 'error';
}

export async function lookupParentAccountForPlayerLink(input: {
  teamSeasonId: string;
  playerId: string;
  email: string;
}): Promise<GuardianLookupResult> {
  const email = normalizeGuardianEmail(input.email);
  if (!email) {
    return {
      status: 'invalid_email',
      userId: null,
      displayName: null,
      email: null,
      message: 'Bitte eine E-Mail-Adresse eingeben.',
    };
  }
  if (!isValidAccountEmail(email)) {
    return {
      status: 'invalid_email',
      userId: null,
      displayName: null,
      email: null,
      message: 'Bitte eine gültige E-Mail-Adresse eingeben.',
    };
  }

  const { data, error } = await supabase.rpc('lookup_parent_account_for_player_link', {
    p_team_season_id: input.teamSeasonId,
    p_player_id: input.playerId,
    p_email: email,
  });

  if (error) {
    const msg = error.message ?? '';
    if (/not allowed|forbidden/i.test(msg)) {
      return {
        status: 'forbidden',
        userId: null,
        displayName: null,
        email: null,
        message: 'Keine Berechtigung für diese Aktion.',
      };
    }
    return {
      status: 'error',
      userId: null,
      displayName: null,
      email: null,
      message: 'Suche fehlgeschlagen. Bitte erneut versuchen.',
    };
  }

  const st = statusOf(data);
  const row = asRecord(data);

  if (st === 'found') {
    return {
      status: 'found',
      userId: row.user_id != null ? String(row.user_id) : null,
      displayName: row.display_name != null ? String(row.display_name) : null,
      email: row.email != null ? String(row.email) : email,
      message: null,
    };
  }
  if (st === 'not_found') {
    return {
      status: 'not_found',
      userId: null,
      displayName: null,
      email: email,
      message: 'Zu dieser E-Mail-Adresse wurde noch kein SpielzeitApp-Account gefunden.',
    };
  }
  if (st === 'invalid_email') {
    return {
      status: 'invalid_email',
      userId: null,
      displayName: null,
      email: null,
      message: 'Bitte eine gültige E-Mail-Adresse eingeben.',
    };
  }
  if (st === 'forbidden') {
    return {
      status: 'forbidden',
      userId: null,
      displayName: null,
      email: null,
      message: 'Keine Berechtigung für diese Aktion.',
    };
  }
  if (st === 'player_not_in_team') {
    return {
      status: 'player_not_in_team',
      userId: null,
      displayName: null,
      email: null,
      message: 'Dieser Spieler gehört nicht zu deinem Team.',
    };
  }
  return {
    status: 'error',
    userId: null,
    displayName: null,
    email: null,
    message: 'Suche fehlgeschlagen. Bitte erneut versuchen.',
  };
}

export async function linkPlayerGuardian(input: {
  teamSeasonId: string;
  playerId: string;
  parentUserId: string;
}): Promise<GuardianLinkResult> {
  const { data, error } = await supabase.rpc('link_player_guardian', {
    p_team_season_id: input.teamSeasonId,
    p_player_id: input.playerId,
    p_parent_user_id: input.parentUserId,
  });

  if (error) {
    const msg = error.message ?? '';
    if (/unique|duplicate/i.test(msg)) {
      return {
        status: 'already_linked',
        displayName: null,
        message: 'Dieser Account ist bereits mit dem Spieler verknüpft.',
      };
    }
    if (/not allowed|forbidden/i.test(msg)) {
      return {
        status: 'forbidden',
        displayName: null,
        message: 'Keine Berechtigung für diese Aktion.',
      };
    }
    return {
      status: 'error',
      displayName: null,
      message: 'Verknüpfung fehlgeschlagen. Bitte erneut versuchen.',
    };
  }

  const st = statusOf(data);
  const row = asRecord(data);
  const displayName = row.display_name != null ? String(row.display_name) : null;

  if (st === 'linked') {
    return { status: 'linked', displayName, message: null };
  }
  if (st === 'already_linked') {
    return {
      status: 'already_linked',
      displayName,
      message: 'Dieser Account ist bereits mit dem Spieler verknüpft.',
    };
  }
  if (st === 'forbidden') {
    return {
      status: 'forbidden',
      displayName: null,
      message: 'Keine Berechtigung für diese Aktion.',
    };
  }
  if (st === 'player_not_in_team') {
    return {
      status: 'player_not_in_team',
      displayName: null,
      message: 'Dieser Spieler gehört nicht zu deinem Team.',
    };
  }
  if (st === 'not_found') {
    return {
      status: 'not_found',
      displayName: null,
      message: 'Zu dieser E-Mail-Adresse wurde noch kein SpielzeitApp-Account gefunden.',
    };
  }
  return {
    status: 'error',
    displayName: null,
    message: 'Verknüpfung fehlgeschlagen. Bitte erneut versuchen.',
  };
}

export async function unlinkPlayerGuardian(input: {
  teamSeasonId: string;
  playerId: string;
  parentUserId: string;
}): Promise<GuardianUnlinkResult> {
  const { data, error } = await supabase.rpc('unlink_player_guardian', {
    p_team_season_id: input.teamSeasonId,
    p_player_id: input.playerId,
    p_parent_user_id: input.parentUserId,
  });

  if (error) {
    const msg = error.message ?? '';
    if (/not allowed|forbidden/i.test(msg)) {
      return {
        status: 'forbidden',
        displayName: null,
        message: 'Keine Berechtigung für diese Aktion.',
      };
    }
    return {
      status: 'error',
      displayName: null,
      message: 'Entfernen fehlgeschlagen. Bitte erneut versuchen.',
    };
  }

  const st = statusOf(data);
  const row = asRecord(data);
  const displayName = row.display_name != null ? String(row.display_name) : null;

  if (st === 'unlinked') {
    return { status: 'unlinked', displayName, message: null };
  }
  if (st === 'not_linked') {
    return {
      status: 'not_linked',
      displayName,
      message: 'Die Verknüpfung war bereits entfernt.',
    };
  }
  if (st === 'forbidden') {
    return {
      status: 'forbidden',
      displayName: null,
      message: 'Keine Berechtigung für diese Aktion.',
    };
  }
  if (st === 'player_not_in_team') {
    return {
      status: 'player_not_in_team',
      displayName: null,
      message: 'Dieser Spieler gehört nicht zu deinem Team.',
    };
  }
  return {
    status: 'error',
    displayName: null,
    message: 'Entfernen fehlgeschlagen. Bitte erneut versuchen.',
  };
}
