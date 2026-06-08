import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type ParentLinkInfo = {
  user_id: string;
  name: string;
  email: string | null;
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

function parseParents(raw: unknown): ParentLinkInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item == null || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const userId = String(o.user_id ?? "").trim();
      if (!userId) return null;
      const name = String(o.name ?? "").trim() || "Elternteil";
      const emailRaw = o.email;
      const email =
        emailRaw != null && String(emailRaw).trim() !== "" ? String(emailRaw).trim() : null;
      return { user_id: userId, name, email };
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
