import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type TeamStaffMember = {
  user_id: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
};

const STAFF_ROLES = new Set(["trainer", "co_trainer", "head_coach"]);

function mapStaffRow(row: {
  user_id: string;
  role: string;
  profiles:
    | {
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
        email?: string | null;
        avatar_url?: string | null;
      }
    | {
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
        email?: string | null;
        avatar_url?: string | null;
      }[]
    | null;
}): TeamStaffMember | null {
  const role = (row.role ?? "").trim().toLowerCase();
  if (!STAFF_ROLES.has(role)) return null;
  const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    user_id: row.user_id,
    role,
    first_name: p?.first_name ?? null,
    last_name: p?.last_name ?? null,
    phone: p?.phone ?? null,
    email: p?.email ?? null,
    avatar_url: p?.avatar_url ?? null,
  };
}

export function useTeamStaff(teamSeasonId: string | null) {
  const [staff, setStaff] = useState<TeamStaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!teamSeasonId) {
      setStaff([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("memberships")
      .select("user_id, role, profiles(first_name, last_name, phone, email, avatar_url)")
      .eq("team_season_id", teamSeasonId);

    if (queryError) {
      setStaff([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const mapped = ((data ?? []) as Parameters<typeof mapStaffRow>[0][])
      .map(mapStaffRow)
      .filter((m): m is TeamStaffMember => m != null)
      .sort((a, b) => {
        const rank = (r: string) =>
          r === "head_coach" ? 0 : r === "co_trainer" ? 1 : r === "trainer" ? 2 : 9;
        const d = rank(a.role) - rank(b.role);
        if (d !== 0) return d;
        const an = `${a.last_name ?? ""} ${a.first_name ?? ""}`.trim().toLocaleLowerCase("de-AT");
        const bn = `${b.last_name ?? ""} ${b.first_name ?? ""}`.trim().toLocaleLowerCase("de-AT");
        return an.localeCompare(bn, "de-AT");
      });

    setStaff(mapped);
    setLoading(false);
  }, [teamSeasonId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { staff, loading, error, refetch };
}

export function staffDisplayName(m: Pick<TeamStaffMember, "first_name" | "last_name">): string {
  const full = [m.first_name, m.last_name].map((x) => (x ?? "").trim()).filter(Boolean).join(" ").trim();
  return full || "Trainer";
}

export function staffRoleLabelDe(rawRole: string): string {
  const s = rawRole.trim().toLowerCase();
  if (s === "head_coach") return "Cheftrainer";
  if (s === "co_trainer") return "Co-Trainer";
  if (s === "trainer") return "Trainer";
  return "Trainer";
}
