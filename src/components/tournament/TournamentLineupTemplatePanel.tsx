import type { FieldSlotId } from '../../types/match';
import { moveTournamentLineupPlayer } from '../../lib/tournamentLineupMove';
import { LeibchenJersey } from '../match/LeibchenJersey';
import { matchdayBenchTileClass } from '../../lib/matchdayPlayerCard';
import { useDemoMode } from "../../demo/DemoContext";
import { writeMatchLineupVariants } from "../../lib/matchLineupVariants";
import React, { useEffect, useState, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  U11_FORMATIONS,
  U11_FORMATION_CHOICES,
  type U11FormationId,
} from "../../lib/matchFormations";
import {
  emptyTournamentTemplate,
  normalizeTournamentTemplate,
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
import { PitchPlayerMarker } from "../match/PitchPlayerMarker";
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
  "min-h-12 w-full rounded-xl border border-[rgb(var(--club-border-rgb)/0.3)] bg-[#0c0c0f] px-3 py-2 text-[16px] text-white";
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
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const drag = useRef<{id:string;x:number;y:number;moved:boolean} | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => { setSelectedPlayer(null); drag.current = null; }, [eventId]);
  const [draft, setDraft] = useState<StoredMatchLineupVariants>(() =>
    emptyTournamentTemplate([], undefined, 'single'),
  );
  const [saved, setSaved] = useState<TournamentTemplateRecord | null>(null);
  const [squad, setSquad] = useState<string[]>([]);
  const [block, setBlock] = useState<1 | 2>(1);
  useEffect(() => { setSelectedPlayer(null); drag.current = null; }, [block]);
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
        setDraft(record?.blocks ?? emptyTournamentTemplate(roster.data, undefined, 'single'));
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
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved?.blocks ?? emptyTournamentTemplate(squad, undefined, 'single'));
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
  const useBlocks = draft.lineupMode !== 'single';
  const currentBlock = useBlocks ? block : 1;
  const current = draft.variants[currentBlock];
  const selectedPlayers = players.filter(
    (p) => squad.includes(p.id) && !p.is_injured,
  );
  const layout = U11_FORMATIONS[current.formationId];
  const edit = (next: StoredMatchLineupVariants) => {
    setDraft(next);
    setMessage(null);
  };
  const setFormation = (formationId: U11FormationId) => {
    setSelectedPlayer(null);
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
  const movePlayer = (id: string, target: FieldSlotId | null) => {
    if (!canEdit || busy || !selectedPlayers.some(p => p.id === id)) return;
    setDraft(previous => {
      const next=structuredClone(previous);
      next.variants[currentBlock].slots=moveTournamentLineupPlayer(previous.variants[currentBlock].slots,id,target);
      return next;
    });
    setMessage(null);
    setSelectedPlayer(null);
  };
  const tapSlot = (slot: FieldSlotId) => {
    if (!canEdit || busy) return;
    if (selectedPlayer) movePlayer(selectedPlayer, slot);
    else setSelectedPlayer(current.slots[slot]);
  };
  const startDrag = (e: React.PointerEvent<HTMLElement>, id: string | null) => {
    if (!id || !canEdit || busy || e.button !== 0) return;
    drag.current = { id, x:e.clientX, y:e.clientY, moved:false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    if (Math.hypot(e.clientX-drag.current.x, e.clientY-drag.current.y)>8) {
      drag.current.moved = true;
      setSelectedPlayer(drag.current.id);
    }
  };
  const finishDrag = (e: React.PointerEvent<HTMLElement>) => {
    const active = drag.current;
    drag.current = null;
    if (!active?.moved) return;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    const element = document.elementFromPoint(e.clientX,e.clientY);
    const target = element?.closest('[data-lineup-slot]')?.getAttribute('data-lineup-slot');
    if (target && layout.some(row => row.slot === target)) movePlayer(active.id, target as FieldSlotId);
    else if (element?.closest('[data-tournament-bench]')) movePlayer(active.id,null);
    else setSelectedPlayer(null);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = normalizeTournamentTemplate(draft);
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
          ? next.lineupMode === 'single' ? "Aufstellung vollständig gespeichert." : "Block A und B sind vollständig gespeichert."
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
    <div className="min-w-0 w-full space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[20px] font-bold text-white">
          {useBlocks ? "Grundaufstellung · Block A / B" : "Normale Aufstellung"}
        </h3>
        {ready ? (
          <CheckCircle2
            aria-label="Gespeichert und vollständig"
            className="h-6 w-6 shrink-0 text-emerald-400"
          />
        ) : null}
      </div>
      <p className="text-[16px] leading-relaxed text-white/70">
        Vor dem Turnier planen – auch ohne Spielplan. Wähle eine normale Aufstellung oder zwei Blöcke für den Wechsel.
      </p>
      {!squad.length ? (
        <p className="rounded-xl border border-amber-400/25 p-3 text-[16px] text-amber-200">
          Wähle zuerst den Turnierkader unter Schritt 2.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Aufstellungsart">
        {(['single', 'blocks'] as const).map(mode => <button key={mode} type="button"
          disabled={!canEdit || busy} aria-pressed={(draft.lineupMode ?? 'blocks') === mode}
          className={`min-h-12 rounded-xl border px-2 py-2 text-[16px] font-bold ${(draft.lineupMode ?? 'blocks') === mode ? 'sz-club-tab-active text-white' : 'sz-club-event-action text-white/65'}`}
          onClick={() => {
            const next = structuredClone(draft);
            if (mode === 'single' && useBlocks) next.variants[1] = structuredClone(current);
            next.lineupMode = mode;
            next.startVariant = 1;
            setBlock(1);
            edit(next);
          }}>{mode === 'single' ? 'Normale Aufstellung' : 'Block A / B'}</button>)}
      </div>
      {useBlocks ? <div
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
            className={`min-h-12 rounded-xl border px-3 py-2 text-[17px] font-bold ${block === n ? "sz-club-tab-active" : "sz-club-event-action text-white/65"}`}
          >
            Block {n === 1 ? "A" : "B"}
            {draft.startVariant === n ? " · Start" : ""}
          </button>
        ))}
      </div> : null}
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
      <p className="text-[14px] text-white/65" role="status">
        {selectedPlayer ? 'Zielposition antippen oder auf die Ersatzbank setzen.' : 'Spieler ziehen oder antippen und danach die Zielposition wählen. Besetzte Positionen werden getauscht.'}
      </p>
      <div onClickCapture={e => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); } }}>
      <div className="mx-auto w-full max-w-lg">
        <LineupFormationPitch
          formationId={current.formationId}
          slots={current.slots}
          displayMode="lineup-fullscreen"
          interactive={canEdit && !busy}
          onSlotTap={tapSlot}
          selectedBankPlayerId={selectedPlayer}
          emphasizedPlayerId={selectedPlayer}
          renderSlotContent={({ playerId, label, isGk }) => {
            const player = selectedPlayers.find(p => p.id === playerId);
            return <div key={playerId || `empty-${label}`} style={{touchAction:canEdit ? 'none' : 'auto'}}
              onPointerDown={e => startDrag(e, playerId)} onPointerMove={moveDrag}
              onPointerUp={finishDrag} onPointerCancel={() => { drag.current=null; }}>
              <PitchPlayerMarker
              lastName={player?.last_name || player?.display_name || 'Position offen'}
              number={player?.jersey_number}
              positionBadge={label}
              variant={isGk ? 'goalkeeper' : 'field'}
              mode="pitch"
              fullscreenLineup
              emphasize={selectedPlayer === playerId && Boolean(playerId)}
            /></div>;
          }}
        />
      </div>
      <section data-tournament-bench className="mt-3 min-w-0 w-full max-w-full border-t border-white/10 pt-3" aria-label="Ersatzbank">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold uppercase tracking-wider text-white/65">Ersatzbank</h4>
          {selectedPlayer && Object.values(current.slots).includes(selectedPlayer) ? <button type="button"
            className="min-h-11 rounded-full border border-white/20 px-3 text-sm font-bold text-white"
            disabled={!canEdit || busy} onClick={() => movePlayer(selectedPlayer,null)}>Auf die Bank</button> : null}
        </div>
        <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-3 [-webkit-overflow-scrolling:touch]" style={{touchAction:'pan-x'}} aria-label="Ersatzbank seitlich scrollen" tabIndex={0}>
        <div className="flex w-max min-w-full flex-nowrap gap-2">
          {selectedPlayers.filter(p => !Object.values(current.slots).includes(p.id)).map(p =>
            <button key={p.id} type="button" disabled={!canEdit || busy}
              aria-label={`${p.display_name} auswählen`} aria-pressed={selectedPlayer === p.id}
              className={`${matchdayBenchTileClass(selectedPlayer === p.id)} !w-[88px] !min-w-[88px] !shrink-0`} style={{touchAction:'pan-x'}}
              onPointerDown={e => { if (e.pointerType !== 'touch') startDrag(e,p.id); }} onPointerMove={moveDrag} onPointerUp={finishDrag}
              onPointerCancel={() => { drag.current=null; }}
              onClick={() => setSelectedPlayer(selectedPlayer === p.id ? null : p.id)}>
              <LeibchenJersey lastName={p.last_name || p.display_name || 'Spieler'} number={p.jersey_number} position=""
                variant="field" size="compact" showBackPrint={false} pitchStyleBack selected={selectedPlayer === p.id}/>
              <span className="mt-1 block w-full truncate text-center text-xs font-bold text-white">{p.last_name || p.display_name}</span>
            </button>)}
          {!selectedPlayers.some(p => !Object.values(current.slots).includes(p.id)) ? <p className="py-3 text-sm text-white/50">Alle Spieler sind auf dem Feld.</p> : null}
        </div>
        </div>
      </section>
      </div>
      {canEdit ? (
        <div className={`grid gap-2 ${useBlocks ? 'grid-cols-3' : 'grid-cols-1'}`} aria-label="Blockaktionen">
          {useBlocks ? <><button
            disabled={busy}
            onClick={() => {
              const next = structuredClone(draft);
              next.startVariant = block;
              edit(next);
            }}
            className={`${dsSecondaryCtaClass()} w-full !min-h-[64px] !rounded-xl !px-2 !text-[14px] !leading-snug`}
          >
            Startblock {block === 1 ? "A" : "B"}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              const next = structuredClone(draft);
              next.variants[block === 1 ? 2 : 1] = structuredClone(current);
              edit(next);
            }}
            className={`${dsSecondaryCtaClass()} w-full !min-h-[64px] !rounded-xl !px-2 !text-[14px] !leading-snug`}
          >
            {block === 1 ? "A → B" : "B → A"} kopieren
          </button></> : null}
          <button
            disabled={busy || !squad.length}
            onClick={() => void save()}
            className={`${dsPrimaryCtaClass()} w-full !min-h-[64px] !rounded-xl !px-2 !text-[14px] !leading-snug`}
          >
            {busy
              ? "Speichert…"
              : tournamentTemplateReady(draft, squad, unavailable)
                ? "Speichern"
                : "Entwurf speichern"}
          </button>
        </div>
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
