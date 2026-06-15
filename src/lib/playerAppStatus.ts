import { VIENNA_TZ } from './viennaTime';

export type PlayerAppStatus = 'active' | 'created' | 'not_setup';

export type PlayerAppStatusRow = {
  player_id: string;
  app_status: PlayerAppStatus;
  last_used_at: string | null;
};

export const PLAYER_APP_STATUS_RPC_MIGRATION_HINT =
  'Spieler-App-Status-RPC fehlt. Migration 20260626120000 ausführen.';

export function isPlayerAppStatusRpcMissingError(message: string | null): boolean {
  if (message == null) return false;
  return (
    /could not find the function/i.test(message) ||
    /PGRST202/i.test(message) ||
    /get_team_player_app_status/i.test(message)
  );
}

export function parsePlayerAppStatus(raw: unknown): PlayerAppStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'active' || s === 'created' || s === 'not_setup') return s;
  return 'not_setup';
}

export function formatPlayerAppLastUsed(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: VIENNA_TZ,
  }).format(d);
}

export type PlayerAppStatusDisplay = {
  headline: string;
  subline: string | null;
  status: PlayerAppStatus;
};

/** Zeile 1 + optionale Zeile 2 für Eltern-Tab-Karten (Status wichtiger als Datum). */
export function getPlayerAppStatusDisplay(
  status: PlayerAppStatus,
  lastUsedAt: string | null,
): PlayerAppStatusDisplay {
  if (status === 'active') {
    const last = formatPlayerAppLastUsed(lastUsedAt);
    return {
      headline: '🟢 Spieler-App verbunden',
      subline: last ? `Zuletzt aktiv: ${last}` : null,
      status: 'active',
    };
  }
  if (status === 'created') {
    return {
      headline: '🟡 Spieler-App Zugang erstellt',
      subline: 'Noch nicht angemeldet',
      status: 'created',
    };
  }
  return {
    headline: '⚪ Spieler-App nicht eingerichtet',
    subline: null,
    status: 'not_setup',
  };
}

/** @deprecated Nutze getPlayerAppStatusDisplay für zweizeilige Darstellung. */
export function formatPlayerAppStatusCardLine(
  status: PlayerAppStatus,
  lastUsedAt: string | null,
): string {
  const { headline, subline } = getPlayerAppStatusDisplay(status, lastUsedAt);
  return subline ? `${headline}\n${subline}` : headline;
}

export function playerAppStatusHeadlineClass(status: PlayerAppStatus): string {
  if (status === 'active') {
    return 'text-[12px] font-semibold leading-snug text-emerald-200/95 sm:text-[13px]';
  }
  if (status === 'created') {
    return 'text-[12px] font-semibold leading-snug text-amber-200/95 sm:text-[13px]';
  }
  return [
    'inline-flex rounded-lg border border-white/24 bg-white/[0.09] px-2.5 py-1',
    'text-[12px] font-semibold leading-snug text-white/92',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.04)]',
    'sm:text-[13px]',
  ].join(' ');
}

export function playerAppStatusSublineClass(status: PlayerAppStatus): string {
  if (status === 'active') {
    return 'text-[11px] leading-snug text-emerald-100/55 sm:text-[12px]';
  }
  if (status === 'created') {
    return 'text-[11px] leading-snug text-amber-100/55 sm:text-[12px]';
  }
  return 'text-[11px] leading-snug text-white/45 sm:text-[12px]';
}

export type PlayerAppStatusSummary = {
  active: number;
  created: number;
  notSetup: number;
};

export function summarizePlayerAppStatus(rows: PlayerAppStatusRow[]): PlayerAppStatusSummary {
  let active = 0;
  let created = 0;
  let notSetup = 0;
  for (const row of rows) {
    if (row.app_status === 'active') active += 1;
    else if (row.app_status === 'created') created += 1;
    else notSetup += 1;
  }
  return { active, created, notSetup };
}

export function playerAppStatusMap(
  rows: PlayerAppStatusRow[],
): Map<string, PlayerAppStatusRow> {
  return new Map(rows.map((r) => [r.player_id, r]));
}
