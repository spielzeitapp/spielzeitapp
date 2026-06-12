import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type ParentLinkInfo = {
  user_id: string;
  name: string | null;
  display_name: string | null;
  email: string | null;
  push_active?: boolean;
  push_device_count?: number;
};

export type PlayerParentLinkRow = {
  player_id: string;
  player_name: string;
  jersey_number: number | null;
  status: string;
  is_active: boolean;
  parent_count: number;
  parents: ParentLinkInfo[];
};

export const PARENT_LINKS_RPC_MIGRATION_HINT =
  "Eltern-RPC fehlt. Migration 20260619120000 ausführen.";

function isParentLinksRpcMissingError(message: string | null): boolean {
  if (message == null) return false;
  return (
    /could not find the function/i.test(message) ||
    /PGRST202/i.test(message) ||
    /get_team_player_parent_links/i.test(message)
  );
}

function pickParentName(o: Record<string, unknown>): string | null {
  const first = o.first_name != null ? String(o.first_name).trim() : "";
  const last = o.last_name != null ? String(o.last_name).trim() : "";
  const fromParts = [first, last].filter(Boolean).join(" ").trim();

  const candidates = [o.display_name, o.name, fromParts || null];
  for (const raw of candidates) {
    const s = raw != null ? String(raw).trim() : "";
    if (s.length > 0 && s !== "Elternteil") return s;
  }
  return null;
}

/** Hauptzeile: Name → E-Mail → Fallback. */
export function parentPrimaryLabel(parent: ParentLinkInfo): string {
  return (
    parent.name?.trim() ||
    parent.display_name?.trim() ||
    parent.email?.trim() ||
    "Elternaccount"
  );
}

/** E-Mail-Zeile nur, wenn sie sich von der Hauptzeile unterscheidet. */
export function parentShowEmailBelow(parent: ParentLinkInfo): boolean {
  const label = parentPrimaryLabel(parent);
  const email = parent.email?.trim() ?? "";
  return email.length > 0 && email !== label;
}

export function parentPushDeviceLabel(count: number | undefined): string | null {
  const n = typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n <= 1) return null;
  return `${n} Geräte`;
}

function parseParents(raw: unknown): ParentLinkInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item == null || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const userId = String(o.user_id ?? "").trim();
      if (!userId) return null;
      const displayName = pickParentName(o);
      const emailRaw = o.email;
      const email =
        emailRaw != null && String(emailRaw).trim() !== "" ? String(emailRaw).trim() : null;
      const pushActive = o.push_active === true;
      const rawCount = o.push_device_count;
      const pushDeviceCount =
        typeof rawCount === "number" && Number.isFinite(rawCount)
          ? Math.max(0, Math.floor(rawCount))
          : typeof rawCount === "string" && rawCount.trim() !== ""
            ? Math.max(0, Math.floor(Number(rawCount)) || 0)
            : pushActive
              ? 1
              : 0;

      return {
        user_id: userId,
        name: displayName,
        display_name: displayName,
        email,
        push_active: pushActive,
        push_device_count: pushDeviceCount,
      };
    })
    .filter((x): x is ParentLinkInfo => x != null);
}

function mapRow(raw: Record<string, unknown>): PlayerParentLinkRow {
  const jersey =
    raw.jersey_number == null || raw.jersey_number === ""
      ? null
      : Number(raw.jersey_number);
  return {
    player_id: String(raw.player_id),
    player_name: String(raw.player_name ?? "Spieler").trim() || "Spieler",
    jersey_number: Number.isFinite(jersey) && jersey > 0 ? jersey : null,
    status: String(raw.status ?? "active"),
    is_active: raw.is_active !== false,
    parent_count: Number(raw.parent_count ?? 0) || 0,
    parents: parseParents(raw.parents),
  };
}

export async function fetchTeamPlayerParentLinks(
  teamSeasonId: string,
): Promise<{ rows: PlayerParentLinkRow[]; error: string | null; rpcMissing: boolean }> {
  const { data, error } = await supabase.rpc("get_team_player_parent_links", {
    p_team_season_id: teamSeasonId,
  });

  if (error) {
    const msg = error.message ?? "Eltern-Verknüpfungen konnten nicht geladen werden.";
    if (isParentLinksRpcMissingError(msg)) {
      return { rows: [], error: msg, rpcMissing: true };
    }
    if (/not allowed/i.test(msg)) {
      return { rows: [], error: "Keine Berechtigung für diese Übersicht.", rpcMissing: false };
    }
    return { rows: [], error: msg, rpcMissing: false };
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  return { rows, error: null, rpcMissing: false };
}

export function useTeamPlayerParentLinks(teamSeasonId: string | null, enabled = true) {
  const [rows, setRows] = useState<PlayerParentLinkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpcMissing, setRpcMissing] = useState(false);

  const refetch = useCallback(async () => {
    if (!teamSeasonId || !enabled) {
      setRows([]);
      setLoading(false);
      setError(null);
      setRpcMissing(false);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await fetchTeamPlayerParentLinks(teamSeasonId);
    setRpcMissing(result.rpcMissing);

    if (result.error) {
      setRows([]);
      setError(result.error);
      setLoading(false);
      return;
    }

    setRows(result.rows);
    setLoading(false);
  }, [teamSeasonId, enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { rows, loading, error, rpcMissing, refetch };
}

export function buildParentReminderWhatsAppText(playerName: string): string {
  const name = playerName.trim();
  if (name && name !== "Spieler") {
    return `Hallo! Bitte melde dich noch in der SpielzeitApp an und verknüpfe dein Kind ${name} mit dem Team. Dann bekommst du Termine, Absagen und Spielinfos direkt in der App. Danke!`;
  }
  return "Hallo! Bitte melde dich noch in der SpielzeitApp an und verknüpfe dein Kind mit dem Team. Dann bekommst du Termine, Absagen und Spielinfos direkt in der App. Danke!";
}

/** Push-Erinnerung für verknüpfte Eltern ohne aktive Benachrichtigungen. */
export function buildPushReminderText(
  parentName?: string | null,
  playerName?: string | null,
): string {
  const parent = parentName?.trim();
  const player = playerName?.trim();
  const greeting =
    parent && parent !== "Elternaccount" ? `Hallo ${parent}!` : "Hallo!";
  const playerHint =
    player && player !== "Spieler"
      ? `\n\nAls Elternteil von ${player} ist es besonders wichtig, dass du Benachrichtigungen aktivierst.`
      : "";

  return `${greeting}

Bitte öffne einmal die SpielzeitApp und aktiviere die Benachrichtigungen.${playerHint}

So erhältst du wichtige Informationen zu Spielen, Trainings, Treffpunkten, Absagen und kurzfristigen Änderungen direkt aufs Handy.

In der App einfach auf „Benachrichtigungen aktivieren“ tippen und danach „Erlauben“ auswählen.

Vielen Dank!`;
}
