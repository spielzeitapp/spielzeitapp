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

        // player_guardians: Spalte user_id (eingeloggter Eltern-User)
        const res = await supabase
          .from("player_guardians")
          .select("player_id")
          .eq("user_id", user.id);
        console.log("[PLAYER GUARDIAN LOOKUP RESULT]", { data: res.data, error: res.error });

        if (!alive) return;

        if (res.error) {
          console.error("[useAvailabilityPermissions] player_guardians Abfrage fehlgeschlagen:", res.error);
          setError(res.error.message);
          setAllowedPlayerIds(new Set());
        } else {
          const ids = (res.data ?? []).map((r: { player_id: string }) => r.player_id);
          if (role === "parent" && ids.length === 0) {
            console.warn("[useAvailabilityPermissions] Parent hat keine player_ids aus player_guardians (user_id). Prüfe Verknüpfung Kind–Konto.");
          }
          setAllowedPlayerIds(new Set(ids));
        }

        setLoading(false);
        return;
      }

      // Player: nur sich selbst via player_users (user_id <-> player_id)
      if (role === "player") {
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
        const res = await supabase
          .from("player_users")
          .select("player_id")
          .eq("user_id", user.id);
        if (!alive) return;
        if (res.error) {
          setError(res.error.message);
          setAllowedPlayerIds(new Set());
        } else {
          const ids = (res.data ?? []).map((r: { player_id: string }) => r.player_id);
          setAllowedPlayerIds(new Set(ids));
        }
        setLoading(false);
        return;
      }

      // Default: nichts erlaubt
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

  /** Für Parent: Kinder (player_guardians). Für Player: Selbst (player_users). Für Trainer: []. Für Zu-/Absage-Persistenz. */
  const myAttendancePlayerIds = useMemo(() => {
    if (allowedPlayerIds.has("*")) return [];
    return Array.from(allowedPlayerIds);
  }, [allowedPlayerIds]);

  return { canEdit, myAttendancePlayerIds, loading, error };
}
