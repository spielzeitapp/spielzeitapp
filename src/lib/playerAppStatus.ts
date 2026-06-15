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

export function formatPlayerAppStatusCardLine(
  status: PlayerAppStatus,
  lastUsedAt: string | null,
): string {
  if (status === 'active') {
    const last = formatPlayerAppLastUsed(lastUsedAt);
    return last
      ? `🟢 Spieler-App verbunden · letzte Anmeldung ${last}`
      : '🟢 Spieler-App verbunden';
  }
  if (status === 'created') {
    return '🟡 Spieler-App Zugang erstellt · noch nicht angemeldet';
  }
  return '⚪ Spieler-App nicht eingerichtet';
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
