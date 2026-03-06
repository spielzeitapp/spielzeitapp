import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useAvailabilityPermissions(params: {
  role: string | null;
  teamSeasonId: string | null;
}) {
  const { role } = params;

  const [allowedPlayerIds, setAllowedPlayerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setError(null);

      // Trainer/Admin: alles erlaubt
      if (role === "trainer" || role === "admin") {
        if (alive) {
          setAllowedPlayerIds(new Set(["*"]));
          setLoading(false);
        }
        return;
      }

      // Parent: nur eigene Kinder via player_guardians
      if (role === "parent") {
        setLoading(true);
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) {
          if (alive) {
            setAllowedPlayerIds(new Set());
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("player_guardians")
          .select("player_id")
          .eq("user_id", user.id);

        if (!alive) return;

        if (error) {
          setError(error.message);
          setAllowedPlayerIds(new Set());
        } else {
          setAllowedPlayerIds(new Set((data ?? []).map((r: { player_id: string }) => r.player_id)));
        }

        setLoading(false);
        return;
      }

      // Default: nichts erlaubt (Player-Regel später, wenn player<->user mapping klar ist)
      if (alive) {
        setAllowedPlayerIds(new Set());
        setLoading(false);
      }
    }

    load().catch((e) => {
      if (!alive) return;
      setError(e?.message ?? "Unbekannter Fehler");
      setAllowedPlayerIds(new Set());
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [role]);

  const canEdit = useMemo(() => {
    return (playerId: string) => {
      if (allowedPlayerIds.has("*")) return true;
      return allowedPlayerIds.has(playerId);
    };
  }, [allowedPlayerIds]);

  /** Für Parent: Liste der player_ids (Kinder); für Player: [] bis user->player Mapping existiert. Für Zu-/Absage-Persistenz. */
  const myAttendancePlayerIds = useMemo(() => {
    if (allowedPlayerIds.has("*")) return [];
    return Array.from(allowedPlayerIds);
  }, [allowedPlayerIds]);

  return { canEdit, myAttendancePlayerIds, loading, error };
}
