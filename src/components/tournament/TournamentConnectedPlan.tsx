import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { usePushSubscription } from "../../hooks/usePushSubscription";
import {
  analyzeTournamentUrl,
  type TournamentPlanAnalysis,
} from "../../lib/tournamentPlanImport";
import type { TournamentStandingsBundle } from "../../lib/tournamentGroupStandings";
import {
  TC_CARD,
  TC_CARD_INNER,
  TC_SECTION_LABEL,
} from "./tournamentCenterStyles";

export type ConnectedTournament = {
  event_id: string;
  source_url: string;
  own_team_name: string | null;
  analysis: TournamentPlanAnalysis;
  synced_at: string | null;
  last_error: string | null;
};
export function officialTournamentStandings(
  state: ConnectedTournament | null,
): TournamentStandingsBundle | null {
  const groups =
    state?.analysis.groupStandings
      ?.filter((g) => g.rows.length)
      .map((g) => ({
        groupLabel: g.groupLabel,
        rows: g.rows.map((r) => ({
          ...r,
          isOurTeam: r.teamName === state.own_team_name,
        })),
        ourRank:
          g.rows.find((r) => r.teamName === state.own_team_name)?.rank ?? null,
        teamCount: g.rows.length,
      })) ?? [];
  return groups.length
    ? {
        source: "official",
        groups,
        primaryGroup: groups.find((g) => g.ourRank != null) ?? groups[0],
      }
    : null;
}
export function TournamentConnectedPlan({
  eventId,
  url,
  userId,
  canManage,
  onUpdated,
  onState,
}: {
  eventId: string;
  url: string | null;
  userId: string | null;
  canManage: boolean;
  onUpdated: () => Promise<void>;
  onState: (state: ConnectedTournament | null) => void;
}) {
  const [state, setState] = useState<ConnectedTournament | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentEvent = useRef(`${eventId}|${url}`);
  currentEvent.current = `${eventId}|${url}`;
  const push = usePushSubscription(userId ?? undefined);
  const load = useCallback(async () => {
    if (eventId === "ev-tournament") return;
    const { data, error } = await supabase
      .from("tournament_sync_state")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    if (!error && currentEvent.current === `${eventId}|${url}`) {
      const current =
        data?.source_url === url ? (data as ConnectedTournament) : null;
      setState(current);
      onState(current);
    }
  }, [eventId, url, onState]);
  useEffect(() => {
    setState(null);
    onState(null);
    let active = true;
    void load();
    const timer = window.setInterval(() => {
      if (active && document.visibilityState !== "hidden") void load();
    }, 20_000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [load]);
  useEffect(() => {
    setEnabled(false);
    if (!userId || eventId === "ev-tournament") return;
    void supabase
      .from("tournament_reminder_subscriptions")
      .select("enabled")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setEnabled(data?.enabled === true));
  }, [eventId, userId]);
  const refresh = async (ownTeam?: string) => {
    if (!url) return;
    setBusy(true);
    setError(null);
    try {
      const r = await analyzeTournamentUrl(url);
      if (!r.ok) throw new Error(r.error);
      const { error } = await supabase.rpc("apply_tournament_plan", {
        p_event: eventId,
        p_url: url,
        p_analysis: r.analysis,
        p_own_team: ownTeam ?? null,
      });
      if (error) throw error;
      await load();
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      if (!enabled && !push.isActive) {
        const ok = await push.activate();
        if (!ok.ok)
          throw new Error("Bitte Push-Mitteilungen für die App aktivieren.");
      }
      const { error } = await supabase
        .from("tournament_reminder_subscriptions")
        .upsert({ event_id: eventId, user_id: userId, enabled: !enabled });
      if (error) throw error;
      setEnabled(!enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  if (eventId === "ev-tournament") return null;
  const age = state?.synced_at
    ? Math.max(
        0,
        Math.floor((Date.now() - Date.parse(state.synced_at)) / 60_000),
      )
    : null;
  return (
    <section className={TC_CARD}>
      <div className={`${TC_CARD_INNER} space-y-3`}>
        <p className={TC_SECTION_LABEL}>{url ? "Veranstalter verbunden" : "Spielerinnerung"}</p>
        <p className="text-[15px] leading-relaxed text-white/70">
          {state?.synced_at
            ? `Stand ${new Date(state.synced_at).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })} · ${age === 0 ? "gerade aktualisiert" : `vor ${age} Min.`}`
            : url ? "Der Veranstalterplan wird geladen." : "Rechtzeitig zurück zum Spielfeld."}{" "}
          {url ? "Spiele und Tabellen bleiben in unserer App." : "Erinnerung für unser nächstes Turnierspiel."}
        </p>
        {state?.last_error ? (
          <p role="status" className="text-[15px] text-amber-300">
            {state?.last_error || "Der letzte Stand ist älter als 5 Minuten."}{" "}
            Der zuletzt geladene Stand bleibt sichtbar.
          </p>
        ) : null}
        {canManage && url ? (
          <>
            <button
              disabled={busy}
              onClick={() => void refresh()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 text-[15px] font-semibold"
            >
              <RefreshCw size={18} />
              Jetzt aktualisieren
            </button>
            {state?.analysis.teams?.length ? (
              <label className="block space-y-1 text-[15px] text-white/80">
                <span>Unsere Mannschaft im Veranstalterplan</span>
                <select
                  aria-label="Unsere Mannschaft im Veranstalterplan"
                  className="min-h-11 w-full rounded-xl border border-white/20 bg-[#111114] px-3 text-white"
                  value={state.own_team_name ?? ""}
                  disabled={busy || Boolean(state.own_team_name)}
                  onChange={(e) => void refresh(e.target.value)}
                >
                  <option value="">Bitte eindeutig zuordnen</option>
                  {state.analysis.teams.map((t) => (
                    <option key={t.teamName} value={t.teamName}>
                      {t.teamName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : null}
        {userId ? (
          <button
            disabled={busy}
            aria-pressed={enabled}
            onClick={() => void toggle()}
            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full border px-4 text-[15px] font-semibold ${enabled ? "sz-club-accent-chip" : "border-white/20"}`}
          >
            <Bell size={19} />
            {enabled
              ? "Erinnerung aktiv · 5 Min. vorher"
              : "5 Minuten vor unserem Spiel erinnern"}
          </button>
        ) : null}
        {enabled ? (
          <p className="text-[14px] text-white/60">
            Gilt für dieses Turnier, auch bei geschlossener App. Geänderte
            Beginnzeiten werden berücksichtigt.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[15px] text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
export function TournamentOpponentOutlook({
  state,
}: {
  state: ConnectedTournament | null;
}) {
  const name = state?.own_team_name;
  if (!state || !name) return null;
  const ownRank = state.analysis.groupStandings?.flatMap((g) =>
    g.rows
      .filter((r) => r.teamName === name)
      .map((r) => ({ group: g.groupLabel, rank: r.rank })),
  )[0];
  const matches = (state.analysis.rawMatches ?? []).filter(
    (m) =>
      m.phase !== "group" &&
      !m.hasResult &&
      (m.homeTeam === name ||
        m.awayTeam === name ||
        m.homeProjection === name ||
        m.awayProjection === name ||
        m.homeCandidates?.includes(name) ||
        m.awayCandidates?.includes(name) ||
        [m.homeSource, m.awaySource].some(
          (s) =>
            s?.type === "group" &&
            s.groupLabel === ownRank?.group &&
            s.rank === ownRank?.rank,
        )),
  );
  if (!matches.length) return null;
  return (
    <section className={TC_CARD}>
      <div className={`${TC_CARD_INNER} space-y-3`}>
        <p className={TC_SECTION_LABEL}>Ausblick Finalrunde</p>
        {matches.slice(0, 3).map((m) => {
          const ours =
            m.homeTeam === name ||
            m.homeProjection === name ||
            m.homeCandidates?.includes(name);
          const source = ours ? m.awaySource : m.homeSource;
          const projection =
            (ours ? m.awayProjection : m.homeProjection) ||
            (ours ? m.awayCandidates : m.homeCandidates)?.join(" oder ");
          const opponent = ours ? m.awayTeam : m.homeTeam;
          const confirmed =
            m.homeConfirmed !== false && m.awayConfirmed !== false;
          return (
            <div
              key={m.externalMatchId ?? m.kickoffTimeHHmm}
              className="rounded-xl border border-white/10 p-3"
            >
              <p className="text-[16px] font-bold">
                {m.roundLabel ??
                  (m.phase === "semifinal" ? "Halbfinale" : "Finalrunde")}{" "}
                · {m.kickoffTimeHHmm}
              </p>
              <p className="text-[15px] text-white/80">
                {confirmed
                  ? `Bestätigt: ${opponent}`
                  : `Aktuell möglich: ${projection ?? opponent}`}
              </p>
              {!confirmed ? (
                <p className="mt-1 text-[14px] text-white/55">
                  {source?.label} · Vorläufig nach Veranstaltertabelle; noch
                  nicht bestätigt.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
