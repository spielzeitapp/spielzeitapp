/**
 * Trainer: Eltern-Einladung (E-Mail + Code-Fallback), getrennt von Spieler-Code/PIN/QR.
 */

import { isSafeAuthRedirectPath } from './authRedirect';
import {
  isParentInviteTokenShape,
  normalizeParentInviteToken,
} from './parentChildLink';
import { supabase } from './supabaseClient';

export type ParentInviteState = 'open' | 'used' | 'revoked' | 'expired';

export type ParentInviteInfo = {
  id: string;
  createdAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  usedAt: string | null;
  emailedAt: string | null;
  lastSentAt: string | null;
  recipientEmailMasked: string | null;
  channel: 'email' | 'code';
  state: ParentInviteState;
};

export type CreateParentInviteResult = {
  status: 'created' | 'forbidden' | 'invalid_input' | 'invalid_email' | 'player_not_in_team' | 'not_authenticated' | 'error';
  inviteId: string | null;
  tokenPlain: string | null;
  expiresAt: string | null;
  recipientEmailMasked: string | null;
  message: string | null;
};

export type SendParentEmailInviteResult = {
  ok: boolean;
  status: string;
  inviteId: string | null;
  expiresAt: string | null;
  recipientEmailMasked: string | null;
  emailSent: boolean;
  codeFallback: string | null;
  mailBlocker: string | null;
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
  recipientEmail?: string | null;
}): Promise<CreateParentInviteResult> {
  const { data, error } = await supabase.rpc('create_parent_link_invite', {
    p_team_season_id: input.teamSeasonId,
    p_player_id: input.playerId,
    p_expires_hours: input.expiresHours ?? 72,
    p_recipient_email: input.recipientEmail?.trim() ? input.recipientEmail.trim() : null,
  });

  if (error) {
    return {
      status: 'error',
      inviteId: null,
      tokenPlain: null,
      expiresAt: null,
      recipientEmailMasked: null,
      message: 'Einladung konnte nicht erstellt werden.',
    };
  }

  const row = asRecord(data);
  const status = String(row.status ?? 'error');
  if (status !== 'created') {
    const messages: Record<string, string> = {
      forbidden: 'Keine Berechtigung für diese Einladung.',
      invalid_input: 'Ungültige Eingabe.',
      invalid_email: 'Bitte eine gültige E-Mail-Adresse eingeben.',
      player_not_in_team: 'Spieler ist nicht im aktiven Kader.',
      not_authenticated: 'Bitte erneut anmelden.',
    };
    return {
      status: (status as CreateParentInviteResult['status']) || 'error',
      inviteId: null,
      tokenPlain: null,
      expiresAt: null,
      recipientEmailMasked: null,
      message: messages[status] ?? 'Einladung konnte nicht erstellt werden.',
    };
  }

  return {
    status: 'created',
    inviteId: row.invite_id != null ? String(row.invite_id) : null,
    tokenPlain: row.token_plain != null ? String(row.token_plain) : null,
    expiresAt: row.expires_at != null ? String(row.expires_at) : null,
    recipientEmailMasked:
      row.recipient_email_masked != null ? String(row.recipient_email_masked) : null,
    message: null,
  };
}

export async function sendParentEmailInvite(input: {
  teamSeasonId: string;
  playerId: string;
  email: string;
  expiresHours?: number;
}): Promise<SendParentEmailInviteResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    return {
      ok: false,
      status: 'not_authenticated',
      inviteId: null,
      expiresAt: null,
      recipientEmailMasked: null,
      emailSent: false,
      codeFallback: null,
      mailBlocker: null,
      message: 'Bitte erneut anmelden.',
    };
  }

  const res = await fetch('/api/parent/send-invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      team_season_id: input.teamSeasonId,
      player_id: input.playerId,
      email: input.email,
      expires_hours: input.expiresHours ?? 72,
    }),
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = asRecord(await res.json());
  } catch {
    payload = {};
  }

  if (!res.ok || payload.ok !== true) {
    const err = String(payload.error ?? 'send_failed');
    const messages: Record<string, string> = {
      Forbidden: 'Keine Berechtigung.',
      invalid_email: 'Bitte eine gültige E-Mail-Adresse eingeben.',
      parent_invite_refuses_live_domain: 'Versand nur auf Staging erlaubt.',
      parent_invite_refuses_live_supabase: 'Versand nur mit Staging-Datenbank erlaubt.',
    };
    return {
      ok: false,
      status: err,
      inviteId: null,
      expiresAt: null,
      recipientEmailMasked: null,
      emailSent: false,
      codeFallback: null,
      mailBlocker: payload.mail_blocker != null ? String(payload.mail_blocker) : null,
      message: messages[err] ?? 'Einladung konnte nicht gesendet werden.',
    };
  }

  return {
    ok: true,
    status: 'created',
    inviteId: payload.invite_id != null ? String(payload.invite_id) : null,
    expiresAt: payload.expires_at != null ? String(payload.expires_at) : null,
    recipientEmailMasked:
      payload.recipient_email_masked != null ? String(payload.recipient_email_masked) : null,
    emailSent: payload.email_sent === true,
    codeFallback: payload.code_fallback != null ? String(payload.code_fallback) : null,
    mailBlocker: payload.mail_blocker != null ? String(payload.mail_blocker) : null,
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
      emailedAt: r.emailed_at != null ? String(r.emailed_at) : null,
      lastSentAt: r.last_sent_at != null ? String(r.last_sent_at) : null,
      recipientEmailMasked:
        r.recipient_email_masked != null ? String(r.recipient_email_masked) : null,
      channel: r.channel === 'email' ? 'email' : 'code',
      state,
    };
  });

  return { invites, error: null };
}

export type ParentInvitePreviewStatus =
  | 'ready'
  | 'needs_auth'
  | 'invalid_token'
  | 'expired'
  | 'revoked'
  | 'already_used'
  | 'already_linked'
  | 'email_mismatch'
  | 'email_not_verified'
  | 'error';

export type ParentInvitePreview = {
  status: ParentInvitePreviewStatus;
  playerDisplayName: string | null;
  teamLabel: string | null;
  seasonLabel: string | null;
  expiresAt: string | null;
  expectedEmailMasked: string | null;
  message: string | null;
};

export type ParentInvitePeek = {
  status: 'ready' | 'invalid_token' | 'expired' | 'revoked' | 'already_used' | 'error';
  recipientEmail: string | null;
  recipientEmailMasked: string | null;
  expiresAt: string | null;
  message: string | null;
};

export async function peekParentLinkInvite(token: string): Promise<ParentInvitePeek> {
  const { data, error } = await supabase.rpc('peek_parent_link_invite', {
    p_token: token,
  });
  if (error) {
    return {
      status: 'error',
      recipientEmail: null,
      recipientEmailMasked: null,
      expiresAt: null,
      message: 'Einladung konnte nicht geprüft werden.',
    };
  }
  const row = asRecord(data);
  const statusRaw = String(row.status ?? 'error');
  const allowed: ParentInvitePeek['status'][] = [
    'ready',
    'invalid_token',
    'expired',
    'revoked',
    'already_used',
    'error',
  ];
  const status = allowed.includes(statusRaw as ParentInvitePeek['status'])
    ? (statusRaw as ParentInvitePeek['status'])
    : 'error';
  const messages: Record<ParentInvitePeek['status'], string | null> = {
    ready: null,
    invalid_token: 'Einladung ungültig.',
    expired: 'Diese Einladung ist abgelaufen.',
    revoked: 'Diese Einladung wurde widerrufen.',
    already_used: 'Diese Einladung wurde bereits verwendet.',
    error: 'Einladung konnte nicht geprüft werden.',
  };
  return {
    status,
    recipientEmail:
      row.recipient_email != null ? String(row.recipient_email).trim().toLowerCase() || null : null,
    recipientEmailMasked:
      row.recipient_email_masked != null ? String(row.recipient_email_masked) : null,
    expiresAt: row.expires_at != null ? String(row.expires_at) : null,
    message: messages[status],
  };
}

export async function previewParentLinkInvite(token: string): Promise<ParentInvitePreview> {
  const { data, error } = await supabase.rpc('preview_parent_link_invite', {
    p_token: token,
  });
  if (error) {
    return {
      status: 'error',
      playerDisplayName: null,
      teamLabel: null,
      seasonLabel: null,
      expiresAt: null,
      expectedEmailMasked: null,
      message: 'Einladung konnte nicht geprüft werden.',
    };
  }
  const row = asRecord(data);
  const status = String(row.status ?? 'error') as ParentInvitePreviewStatus;
  const messages: Partial<Record<ParentInvitePreviewStatus, string>> = {
    needs_auth: 'Bitte zuerst anmelden oder registrieren.',
    invalid_token: 'Einladung ungültig.',
    expired: 'Diese Einladung ist abgelaufen.',
    revoked: 'Diese Einladung wurde widerrufen.',
    already_used: 'Diese Einladung wurde bereits verwendet.',
    already_linked: 'Dieses Kind ist bereits mit deinem Konto verknüpft.',
    email_mismatch: 'Diese Einladung gilt für eine andere E-Mail-Adresse.',
    email_not_verified: 'Bitte zuerst die E-Mail-Adresse bestätigen.',
  };
  return {
    status: status in messages || status === 'ready' ? status : 'error',
    playerDisplayName:
      row.player_display_name != null ? String(row.player_display_name).trim() || null : null,
    teamLabel: row.team_label != null ? String(row.team_label).trim() || null : null,
    seasonLabel: row.season_label != null ? String(row.season_label).trim() || null : null,
    expiresAt: row.expires_at != null ? String(row.expires_at) : null,
    expectedEmailMasked:
      row.expected_email_masked != null ? String(row.expected_email_masked) : null,
    message: status === 'ready' ? null : messages[status] ?? 'Einladung konnte nicht geprüft werden.',
  };
}

export function parentInviteStateLabel(state: ParentInviteState): string {
  switch (state) {
    case 'open':
      return 'Offen';
    case 'used':
      return 'Angenommen';
    case 'revoked':
      return 'Widerrufen';
    case 'expired':
      return 'Abgelaufen';
  }
}

export const PARENT_INVITE_TOKEN_STORAGE_KEY = 'spz_parent_invite_token';
export const PARENT_INVITE_TOKEN_LOCAL_KEY = 'spz_parent_invite_token_v1';
export const PARENT_INVITE_EMAIL_LOCAL_KEY = 'spz_parent_invite_email_v1';
/** Align with default invite TTL (72h). */
const PARENT_INVITE_STASH_TTL_MS = 72 * 60 * 60 * 1000;

type StashedInvitePayload = { token: string; expiresAt: number };

function writeLocalInvitePayload(key: string, value: string): void {
  try {
    const payload: StashedInvitePayload = {
      token: value,
      expiresAt: Date.now() + PARENT_INVITE_STASH_TTL_MS,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function readLocalInvitePayload(key: string): string | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StashedInvitePayload>;
    if (!parsed?.token || typeof parsed.token !== 'string') {
      window.localStorage.removeItem(key);
      return null;
    }
    if (typeof parsed.expiresAt === 'number' && parsed.expiresAt < Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.token.trim() || null;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function stashParentInviteToken(token: string): void {
  try {
    sessionStorage.setItem(PARENT_INVITE_TOKEN_STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
  writeLocalInvitePayload(PARENT_INVITE_TOKEN_LOCAL_KEY, token);
}

export function readStashedParentInviteToken(): string | null {
  try {
    const session = sessionStorage.getItem(PARENT_INVITE_TOKEN_STORAGE_KEY);
    if (session && session.trim()) return session.trim();
  } catch {
    /* ignore */
  }
  return readLocalInvitePayload(PARENT_INVITE_TOKEN_LOCAL_KEY);
}

export function clearStashedParentInviteToken(): void {
  try {
    sessionStorage.removeItem(PARENT_INVITE_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem(PARENT_INVITE_TOKEN_LOCAL_KEY);
  } catch {
    /* ignore */
  }
  clearStashedParentInviteEmail();
}

export function stashParentInviteEmail(email: string): void {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  writeLocalInvitePayload(PARENT_INVITE_EMAIL_LOCAL_KEY, normalized);
}

export function readStashedParentInviteEmail(): string | null {
  return readLocalInvitePayload(PARENT_INVITE_EMAIL_LOCAL_KEY);
}

export function clearStashedParentInviteEmail(): void {
  try {
    window.localStorage.removeItem(PARENT_INVITE_EMAIL_LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

/** Safe relative next path that keeps the invite token across login/register/confirm. */
export function buildParentInviteAuthNext(token: string): string {
  return `/app/parent-invite?t=${encodeURIComponent(token)}`;
}

/** Parse invite token from a safe next path like /app/parent-invite?t=… */
export function extractInviteTokenFromNext(next: string | null | undefined): string | null {
  if (!next || !next.includes('/app/parent-invite')) return null;
  try {
    const qIdx = next.indexOf('?');
    const qs = qIdx >= 0 ? next.slice(qIdx + 1) : '';
    const raw = new URLSearchParams(qs).get('t') ?? '';
    const token = normalizeParentInviteToken(raw);
    return isParentInviteTokenShape(token) ? token : null;
  } catch {
    return null;
  }
}

/** Stash token from next= before login/register so Magic-Link → Login keeps context. */
export function ensureParentInviteContextFromNext(next: string | null | undefined): void {
  const token = extractInviteTokenFromNext(next);
  if (token) stashParentInviteToken(token);
}

/**
 * Capture ?t= from the current URL as early as possible (Magic Link / deep link),
 * before Auth hash processing or React Router may rewrite the location.
 * Re-exported implementation lives next to auth bootstrap in supabaseClient
 * (avoids circular imports); this wrapper also runs from invite helpers.
 */
export function captureParentInviteTokenFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const search = window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : window.location.search;
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const fromSearch = new URLSearchParams(search).get('t');
    const fromHash = new URLSearchParams(hash).get('t');
    const raw = fromSearch || fromHash || '';
    const token = normalizeParentInviteToken(raw);
    if (isParentInviteTokenShape(token)) {
      stashParentInviteToken(token);
    }
  } catch {
    /* ignore */
  }
}

/** Pending personal invite — used to bypass role-choice / self-link until accept/redeem. */
export function resolvePendingParentInvitePath(): string | null {
  captureParentInviteTokenFromUrl();
  const token = readStashedParentInviteToken();
  if (!token || !isParentInviteTokenShape(token)) return null;
  const path = buildParentInviteAuthNext(token);
  return isSafeAuthRedirectPath(path) ? path : null;
}

export function hasPendingParentInvite(): boolean {
  return resolvePendingParentInvitePath() != null;
}
