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

const ACCOUNT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAccountEmail(value: string): boolean {
  return ACCOUNT_EMAIL_RE.test(value.trim());
}

/** PostgREST kann uuid als string oder verpackt liefern. */
export function parseRpcUuid(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === "object" && value !== null && "id" in value) {
    return parseRpcUuid((value as { id: unknown }).id);
  }
  return null;
}

function rpcErrorMessage(err: { message?: string; details?: string; hint?: string } | null): string {
  if (!err) return "Unbekannter Fehler.";
  const parts = [err.message, err.details, err.hint].map((p) => (p ?? "").trim()).filter(Boolean);
  return parts.join(" — ") || "Unbekannter Fehler.";
}

/** Konto-E-Mail → auth.users.id (= profiles.id). Keine Kontakt-E-Mail. */
export async function findAccountUserIdByEmail(
  accountEmail: string,
): Promise<{ userId: string | null; error: string | null }> {
  const email = accountEmail.trim();
  if (!email) return { userId: null, error: "E-Mail ist erforderlich." };
  if (!isValidAccountEmail(email)) {
    return { userId: null, error: "Bitte eine gültige E-Mail (Konto) eingeben." };
  }

  const { data, error } = await supabase.rpc("find_user_id_by_email", { p_email: email });
  if (error) return { userId: null, error: rpcErrorMessage(error) };
  const userId = parseRpcUuid(data);
  return { userId, error: null };
}

export async function fetchProfileNamesForUser(
  userId: string,
): Promise<{ first_name: string | null; last_name: string | null } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    first_name: data.first_name ?? null,
    last_name: data.last_name ?? null,
  };
}

export type SaveTeamStaffInput = {
  teamSeasonId: string;
  userId: string;
  role: "trainer" | "co_trainer" | "head_coach";
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  contactEmail: string | null;
  avatarUrl: string | null;
};

export async function saveTeamStaffMember(
  input: SaveTeamStaffInput,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc("upsert_team_staff_member", {
    p_team_season_id: input.teamSeasonId,
    p_user_id: input.userId,
    p_role: input.role,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: input.phone,
    p_email: input.contactEmail,
    p_avatar_url: input.avatarUrl,
  });

  if (error) {
    const msg = rpcErrorMessage(error);
    if (msg.includes("not allowed")) {
      return { ok: false, error: "Keine Berechtigung, Trainer für dieses Team zu verwalten." };
    }
    if (msg.includes("account not found")) {
      return { ok: false, error: "Kein Konto mit dieser E-Mail. Die Person muss sich zuerst registrieren." };
    }
    if (msg.includes("invalid staff role")) {
      return { ok: false, error: "Ungültige Trainer-Rolle." };
    }
    return { ok: false, error: msg };
  }
  return { ok: true, error: null };
}
