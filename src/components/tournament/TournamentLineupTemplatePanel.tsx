import { Modal } from '../../app/ui/Modal';
import { useNavigate } from 'react-router-dom';
import { useInternalBasePath } from '../../demo/demoPaths';
import { matchLineupPath as matchPreparationPath } from '../../lib/matchPreparationAccess';
import { formatTournamentKickoffTime } from '../../lib/tournamentPlan';
import { TournamentClubLogo } from './TournamentClubLogo';
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
const fieldPlayerCounts = [...new Set(U11_FORMATION_CHOICES.map(id => U11_FORMATIONS[id].length - 1))]
  .sort((a, b) => a - b);

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
  const navigate = useNavigate();
  const [gameToOpen, setGameToOpen] = useState<TournamentMatchSlotView | null>(null);
  const basePath = useInternalBasePath();
  const [appliedMatches, setAppliedMatches] = useState<string[]>([]);
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
  const fieldPlayerCount = layout.length - 1;
  const formationsForFormat = U11_FORMATION_CHOICES.filter(id => U11_FORMATIONS[id].length === layout.length);
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
    (s) => s.match_id && s.match_status === "upcoming" && !s.has_lineup && !appliedMatches.includes(s.match_id),
  );
  const applyToGames = async (games: TournamentMatchSlotView[], openAfter = false) => {
    if (!saved || !ready || busy || !canEdit) return;
    setBusy(true);
    setError(null);
    let count = 0;
    const failures: string[] = [];
    for (const game of games) {
      if (!game.match_id || !eligible.some(s => s.id === game.id)) continue;
      try {
        if (demo) {
          const start = saved.blocks.variants[saved.blocks.startVariant];
          demo.setDemoMatchLineup(game.match_id, start.slots, start.squadIds, start.formationId);
          writeMatchLineupVariants(game.match_id, saved.blocks);
        } else await applyTournamentLineupTemplate(eventId, game.match_id, saved);
        count++;
        setAppliedMatches(ids => [...ids, game.match_id!]);
      } catch (e) {
        failures.push(`${game.opponent_name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setMessage(`${count} ${count === 1 ? 'Spiel vorbereitet' : 'Spiele vorbereitet'} · Kader und Aufstellung übernommen.`);
    if (failures.length) setError(failures.join(' · '));
    setBusy(false);
    if (count) onSaved();
    if (openAfter && !failures.length && games[0]?.match_id) navigate(matchPreparationPath(games[0].match_id, basePath));
  };
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
      <fieldset className="space-y-2" disabled={!canEdit || busy}>
        <legend className="text-[16px] font-semibold text-white">Spielform fürs Turnier</legend>
        <div className="flex flex-wrap gap-2">
          {fieldPlayerCounts.map(count => (
            <button
              key={count}
              type="button"
              aria-pressed={fieldPlayerCount === count}
              className={`min-h-12 flex-1 rounded-xl border px-3 py-2 text-[16px] font-bold ${fieldPlayerCount === count ? 'sz-club-tab-active text-white' : 'sz-club-event-action text-white/65'}`}
              onClick={() => {
                if (fieldPlayerCount === count) return;
                const formation = U11_FORMATION_CHOICES.find(id => U11_FORMATIONS[id].length === count + 1);
                if (formation) setFormation(formation);
              }}
            >
              {count}+1
            </button>
          ))}
        </div>
        <label className="block space-y-2 text-[16px] font-semibold text-white">
          Formation
          <select
            className={input}
            value={current.formationId}
            onChange={(e) => setFormation(e.target.value as U11FormationId)}
          >
            {formationsForFormat.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
      </fieldset>
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
            aria-pressed={draft.startVariant === block}
            disabled={busy}
            onClick={() => {
              const next = structuredClone(draft);
              next.startVariant = block;
              edit(next);
            }}
            className={`${dsSecondaryCtaClass()} ${draft.startVariant === block ? '!border-emerald-400/60 !bg-emerald-500/15 !text-emerald-200' : ''} w-full !min-h-[64px] !rounded-xl !px-2 !text-[14px] !leading-snug`}
          >
            {draft.startVariant === block ? '✓ ' : ''}Startblock {block === 1 ? "A" : "B"}
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
      <Modal open={Boolean(gameToOpen)} onClose={() => setGameToOpen(null)} title="Turnierspiel vorbereiten">
        <p className="mb-3 text-lg font-bold text-white">{gameToOpen?.opponent_name}</p>
        <p className="mb-2 font-bold text-emerald-300">Turniervorlage: {layout.length - 1}+1 · {current.formationId} · {squad.length} Spieler{useBlocks ? ' · Block A / B' : ''}</p>
        <p className="mb-4 text-white/65">{gameToOpen?.match_status === 'finished' ? 'Dieses Spiel ist abgeschlossen. Es zeigt die damals gespeicherte Aufstellung.' : eligible.some(s=>s.id===gameToOpen?.id) ? 'Kader, Formation und Blöcke aus dem Assistenten für dieses Spiel übernehmen.' : 'Dieses Spiel hat bereits eine eigene Aufstellung. Beim Öffnen bleibt sie erhalten; du kannst sie vor Spielbeginn bearbeiten.'}</p>
        <div className="grid grid-cols-2 gap-2">
          <button disabled={busy || !ready} className={`${dsPrimaryCtaClass()} !rounded-xl !px-2 !text-sm`} onClick={() => {
            const game=gameToOpen;if(!game)return;setGameToOpen(null);
            if(eligible.some(s=>s.id===game.id)) void applyToGames([game],true);
            else navigate(matchPreparationPath(game.match_id!,basePath));
          }}>Übernehmen & prüfen</button>
          <button disabled={busy} className={`${dsSecondaryCtaClass()} !rounded-xl !px-2 !text-sm`} onClick={() => {
            const game=gameToOpen;if(!game)return;setGameToOpen(null);
            if(eligible.some(s=>s.id===game.id)) void applyToGames([game],true);
            else navigate(matchPreparationPath(game.match_id!,basePath));
          }}>Aufstellung ändern</button>
        </div>
        <p className="mt-3 text-sm text-white/50">Eine bestehende Spielaufstellung bleibt erhalten. Im nächsten Schritt kannst du Spieler und Positionen ändern.</p>
      </Modal>
      {slots.some(s => s.match_id) ? (
        <section className="space-y-3 border-t border-white/10 pt-4" aria-label="Unsere Spiele vorbereiten">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-[18px] font-bold text-white">Unsere Spiele</h4>
            <span className="text-xs text-white/50">{slots.filter(s => s.match_id).length} Spiele</span>
          </div>
          <p className="text-[14px] leading-relaxed text-white/60">Spiel antippen: Kader und Aufstellung übernehmen, prüfen und zum Matchstart weitergehen.</p>
          {canEdit && eligible.length > 0 ? <button type="button" disabled={busy || !ready}
            onClick={() => void applyToGames(eligible)}
            className={`${dsPrimaryCtaClass()} w-full !min-h-11 !rounded-xl !px-3 !py-2 !text-[14px]`}>
            {busy ? 'Wird übernommen…' : `Kader & Aufstellung für alle übernehmen (${eligible.length})`}
          </button> : null}
          {!ready && canEdit ? <p className="text-[13px] text-amber-200">Zum Übernehmen zuerst die vollständige Grundaufstellung speichern.</p> : null}
          <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            {[...slots].filter(s => s.match_id).sort((a,b) => Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)).map(game => {
              const prepared = game.has_lineup || appliedMatches.includes(game.match_id!);
              const canApply = eligible.some(s => s.id === game.id);
              const status = game.match_status === 'live' ? 'Live' : game.match_status === 'finished' ? 'Beendet' : prepared ? 'Vorbereitet' : 'Offen';
              return <button key={game.id} type="button" disabled={busy || dirty || (canApply && (!ready || !canEdit))}
                aria-label={`${formatTournamentKickoffTime(game.kickoff_at)} · ${game.opponent_name} · ${status}`}
                onClick={() => setGameToOpen(game)}
                className="flex min-h-[72px] w-full items-center gap-3 px-3 py-3 text-left disabled:opacity-50 active:bg-white/5">
                <span className="shrink-0 text-sm font-bold tabular-nums text-white/70">{formatTournamentKickoffTime(game.kickoff_at)}</span>
                <TournamentClubLogo name={game.opponent_name} size="sm"/>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold leading-snug text-white">{game.opponent_name}</span>
                <span className={`mt-1 block text-xs ${prepared ? 'text-emerald-300' : 'text-white/50'}`}>{status}</span></span>
                <span className="shrink-0 text-xl text-white/50" aria-hidden>›</span>
              </button>;
            })}
          </div>
          <p className="text-[12px] leading-relaxed text-white/45">Die Sammelübernahme gilt für offene, leere Aufstellungen. Bereits vorbereitete und gestartete Spiele bleiben erhalten. Änderungen pro Spiel sind danach möglich.</p>
        </section>
      ) : null}
    </div>
  );
}
