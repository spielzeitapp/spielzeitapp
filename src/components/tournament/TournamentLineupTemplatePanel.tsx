import { useDemoMode } from "../../demo/DemoContext";
import { writeMatchLineupVariants } from "../../lib/matchLineupVariants";
import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  U11_FORMATIONS,
  U11_FORMATION_CHOICES,
  type U11FormationId,
} from "../../lib/matchFormations";
import {
  emptyTournamentTemplate,
  tournamentTemplateReady,
} from "../../lib/tournamentLineupTemplate";
import {
  fetchTournamentLineupTemplate,
  saveTournamentLineupTemplate,
  applyTournamentLineupTemplate,
  type TournamentTemplateRecord,
} from "../../lib/tournamentLineupTemplates";
import { fetchTournamentSquadPlayerIds } from "../../lib/tournamentSquad";
import { type StoredMatchLineupVariants } from "../../lib/matchLineupVariants";
import type { PlayerItem } from "../../hooks/usePlayers";
import type { TournamentMatchSlotView } from "../../lib/tournamentPlan";
import { LineupFormationPitch } from "../match/LineupFormationPitch";
import {
  dsPrimaryCtaClass,
  dsSecondaryCtaClass,
} from "../../lib/premiumDesignSystem";

type Props = {
  eventId: string;
  players: PlayerItem[];
  slots: TournamentMatchSlotView[];
  refreshToken: number;
  onSaved: () => void;
  onReady: (ready: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  canEdit: boolean;
};
const input =
  "min-h-12 w-full rounded-xl border border-white/15 bg-[#111114] px-3 py-2 text-[16px] text-white";
export function TournamentLineupTemplatePanel({
  eventId,
  players,
  slots,
  refreshToken,
  onSaved,
  onReady,
  onDirtyChange,
  canEdit,
}: Props) {
  const demo = useDemoMode();
  const [draft, setDraft] = useState<StoredMatchLineupVariants>(() =>
    emptyTournamentTemplate([]),
  );
  const [saved, setSaved] = useState<TournamentTemplateRecord | null>(null);
  const [squad, setSquad] = useState<string[]>([]);
  const [block, setBlock] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchTournamentLineupTemplate(eventId),
      fetchTournamentSquadPlayerIds(eventId),
    ])
      .then(([record, roster]) => {
        if (!active) return;
        if (roster.error) throw new Error(roster.error);
        setSaved(record);
        setSquad(roster.data);
        setDraft(record?.blocks ?? emptyTournamentTemplate(roster.data));
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId, refreshToken, reload]);
  const unavailable = players.filter((p) => p.is_injured).map((p) => p.id);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved?.blocks ?? emptyTournamentTemplate(squad));
  useEffect(() => { onDirtyChange?.(!loading && dirty); }, [loading, dirty, onDirtyChange]);
  const ready =
    Boolean(saved) &&
    !dirty &&
    !error &&
    !loading &&
    tournamentTemplateReady(draft, squad, unavailable);
  useEffect(() => {
    onReady(ready);
  }, [ready, onReady]);
  const current = draft.variants[block];
  const selectedPlayers = players.filter(
    (p) => squad.includes(p.id) && !p.is_injured,
  );
  const layout = U11_FORMATIONS[current.formationId];
  const edit = (next: StoredMatchLineupVariants) => {
    setDraft(next);
    setMessage(null);
  };
  const setFormation = (formationId: U11FormationId) => {
    const next = structuredClone(draft);
    for (const n of [1, 2] as const) {
      next.variants[n].formationId = formationId;
      const allowed = U11_FORMATIONS[formationId].map((x) => x.slot);
      for (const slot of Object.keys(next.variants[n].slots) as Array<
        keyof typeof current.slots
      >) {
        if (!allowed.includes(slot)) next.variants[n].slots[slot] = null;
      }
    }
    edit(next);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = structuredClone(draft);
      for (const n of [1, 2] as const) {
        next.variants[n].squadIds = [...squad];
        for (const s of Object.keys(next.variants[n].slots) as Array<
          keyof typeof current.slots
        >) {
          if (
            !squad.includes(next.variants[n].slots[s] ?? "") ||
            unavailable.includes(next.variants[n].slots[s] ?? "")
          )
            next.variants[n].slots[s] = null;
        }
      }
      const stamp = await saveTournamentLineupTemplate(
        eventId,
        next,
        saved?.updated_at ?? null,
      );
      setDraft(next);
      setSaved({ blocks: next, updated_at: stamp });
      setMessage(
        tournamentTemplateReady(next, squad, unavailable)
          ? "Block A und B sind vollständig gespeichert."
          : "Entwurf gespeichert. Offene Positionen kannst du später ergänzen.",
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const eligible = slots.filter(
    (s) => s.match_id && s.match_status === "upcoming" && !s.has_lineup,
  );
  if (loading)
    return <p className="text-[16px] text-white/65">Lade Grundaufstellung…</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[20px] font-bold text-white">
          Grundaufstellung · Block A / B
        </h3>
        {ready ? (
          <CheckCircle2
            aria-label="Gespeichert und vollständig"
            className="h-6 w-6 shrink-0 text-emerald-400"
          />
        ) : null}
      </div>
      <p className="text-[16px] leading-relaxed text-white/70">
        Vor dem Turnier planen – auch ohne Spielplan. Die gespeicherten Blöcke
        kannst du später in ein eigenes Spiel übernehmen.
      </p>
      {!squad.length ? (
        <p className="rounded-xl border border-amber-400/25 p-3 text-[16px] text-amber-200">
          Wähle zuerst den Turnierkader unter Schritt 2.
        </p>
      ) : null}
      <div
        className="grid grid-cols-2 gap-2"
        role="tablist"
        aria-label="Turnierblöcke"
      >
        {([1, 2] as const).map((n) => (
          <button
            key={n}
            role="tab"
            aria-selected={block === n}
            onClick={() => setBlock(n)}
            className={`min-h-12 rounded-xl border px-3 py-2 text-[17px] font-bold ${block === n ? "sz-club-tab-active" : "border-white/10 text-white/65"}`}
          >
            Block {n === 1 ? "A" : "B"}
            {draft.startVariant === n ? " · Start" : ""}
          </button>
        ))}
      </div>
      <label className="block space-y-2 text-[16px] font-semibold text-white">
        Spielform / Formation
        <select
          disabled={!canEdit || busy}
          className={input}
          value={current.formationId}
          onChange={(e) => setFormation(e.target.value as U11FormationId)}
        >
          {U11_FORMATION_CHOICES.map((id) => (
            <option key={id} value={id}>
              {id} · {U11_FORMATIONS[id].length - 1}+1
            </option>
          ))}
        </select>
      </label>
      <div className="mx-auto max-w-sm">
        <LineupFormationPitch
          formationId={current.formationId}
          slots={current.slots}
          renderSlotContent={({ playerId, label }) => (
            <span className="flex min-h-10 min-w-10 flex-col items-center justify-center rounded-xl bg-black/75 px-2 py-1 text-[12px] font-bold text-white">
              <span>{label}</span>
              <span>
                {selectedPlayers.find((p) => p.id === playerId)?.last_name ||
                  selectedPlayers.find((p) => p.id === playerId)
                    ?.display_name ||
                  "–"}
              </span>
            </span>
          )}
        />
      </div>
      <div className="space-y-3">
        {layout.map(({ slot, label }) => (
          <label
            key={slot}
            className="grid grid-cols-[3rem_1fr] items-center gap-3 text-[16px] font-bold text-white"
          >
            <span>{label}</span>
            <select
              disabled={!canEdit || busy || !squad.length}
              aria-label={`Block ${block === 1 ? "A" : "B"} · ${label}`}
              className={input}
              value={current.slots[slot] ?? ""}
              onChange={(e) => {
                const next = structuredClone(draft);
                const value = e.target.value;
                for (const s of Object.keys(
                  next.variants[block].slots,
                ) as Array<typeof slot>) {
                  if (value && next.variants[block].slots[s] === value)
                    next.variants[block].slots[s] = null;
                }
                next.variants[block].slots[slot] = value || null;
                edit(next);
              }}
            >
              <option value="">Position offen</option>
              {selectedPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jersey_number ? `${p.jersey_number} · ` : ""}
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="text-[15px] text-white/65">
        Bank:{" "}
        {selectedPlayers
          .filter((p) => !Object.values(current.slots).includes(p.id))
          .map((p) => p.display_name)
          .join(", ") || "–"}
      </p>
      {canEdit ? (
        <>
          <button
            disabled={busy}
            onClick={() => {
              const next = structuredClone(draft);
              next.startVariant = block;
              edit(next);
            }}
            className={`${dsSecondaryCtaClass()} w-full !text-[16px]`}
          >
            Block {block === 1 ? "A" : "B"} als Startblock
          </button>
          <button
            disabled={busy}
            onClick={() => {
              const next = structuredClone(draft);
              next.variants[block === 1 ? 2 : 1] = structuredClone(current);
              edit(next);
            }}
            className={`${dsSecondaryCtaClass()} w-full !text-[16px]`}
          >
            Block {block === 1 ? "A nach B" : "B nach A"} kopieren
          </button>
          <button
            disabled={busy || !squad.length}
            onClick={() => void save()}
            className={`${dsPrimaryCtaClass()} min-h-12 w-full !text-[17px]`}
          >
            {busy
              ? "Wird gespeichert…"
              : tournamentTemplateReady(draft, squad, unavailable)
                ? "Grundaufstellung speichern"
                : "Entwurf speichern"}
          </button>
        </>
      ) : null}
      {message ? (
        <p role="status" className="text-[16px] text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="space-y-2 text-[16px] text-amber-200">
          <p>{error}</p>
          <button
            onClick={() => setReload((x) => x + 1)}
            className={dsSecondaryCtaClass()}
          >
            Neu laden
          </button>
        </div>
      ) : null}
      {ready && eligible.length && canEdit ? (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <h4 className="text-[17px] font-bold text-white">
            Für ein Spiel übernehmen
          </h4>
          <p className="text-[15px] text-white/65">
            Nur leere Aufstellungen werden übernommen. Bereits vorbereitete oder
            gestartete Spiele bleiben geschützt.
          </p>
          {eligible.map((s) => (
            <button
              key={s.id}
              disabled={busy}
              className={`${dsSecondaryCtaClass()} w-full !text-[16px]`}
              onClick={async () => {
                if (!saved || !s.match_id) return;
                setBusy(true);
                setError(null);
                try {
                  if (demo) {
                    const start =
                      saved.blocks.variants[saved.blocks.startVariant];
                    demo.setDemoMatchLineup(
                      s.match_id,
                      start.slots,
                      start.squadIds,
                      start.formationId,
                    );
                    writeMatchLineupVariants(s.match_id, saved.blocks);
                  } else
                    await applyTournamentLineupTemplate(
                      eventId,
                      s.match_id,
                      saved,
                    );
                  setMessage(
                    `Grundaufstellung gegen ${s.opponent_name} übernommen.`,
                  );
                  onSaved();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Gegen {s.opponent_name} übernehmen
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
