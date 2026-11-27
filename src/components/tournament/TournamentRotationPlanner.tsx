import React, { useState } from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import type { StoredMatchLineupVariants } from '../../lib/matchLineupVariants';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { generateTournamentRotation, roleForRotationSlot, rotationMinutes, rotationModeForPhase, rotationRoleLabels, validateRotationGame, type RotationRole, type TournamentRotation } from '../../lib/tournamentRotation';
import { U11_FORMATIONS } from '../../lib/matchFormations';

const selectClass = 'min-h-12 w-full rounded-xl border border-white/20 bg-[#0c0c0f] px-3 py-2 text-base text-white';
type Props = { draft: StoredMatchLineupVariants; players: PlayerItem[]; games: TournamentMatchSlotView[]; disabled: boolean; onChange: (next: StoredMatchLineupVariants) => void; onApplyPrepared: (game: TournamentMatchSlotView) => Promise<void> };
export function TournamentRotationPlanner({ draft, players, games, disabled, onChange, onApplyPrepared }: Props) {
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const start = draft.variants[draft.startVariant];
  const config = draft.rotation;
  const name = (id: string) => players.find(p => p.id === id)?.last_name || players.find(p => p.id === id)?.display_name || id;
  const update = (rotation: TournamentRotation) => { setError(''); onChange({ ...draft, rotation }); };
  const enable = () => {
    const positions: TournamentRotation['positions'] = {};
    for (const row of U11_FORMATIONS[start.formationId]) {
      const id = start.slots[row.slot];
      if (id && row.slot !== 'GK') positions[id] = [roleForRotationSlot(row.slot)];
    }
    update({ version: 1, positions, games: {} });
  };
  return <section className="space-y-3 rounded-2xl border border-white/15 p-3 text-white" aria-label="Positionsabhängige Wechselplanung">
    <label className="flex min-h-12 items-center gap-3 text-base font-bold"><input type="checkbox" checked={Boolean(config)} disabled={disabled} onChange={e => {
      if (e.target.checked) enable(); else { const next = { ...draft }; delete next.rotation; delete next.rotationMatch; onChange(next); }
    }}/>Gruppen- und Platzierungsspiele getrennt planen</label>
    {config ? <>
      <p className="text-base text-white/70">Gruppe: alle 3 Minuten zwei Wechsel, mindestens 6 Minuten je Feldspieler. Platzierung: freie Wechsel. Der Tormann der Startaufstellung bleibt fix im Tor.</p>
      <details open><summary className="min-h-11 cursor-pointer py-2 font-bold">Mögliche Spielerpositionen</summary>
        <button type="button" disabled={disabled} className="min-h-11 rounded-xl border border-white/20 px-3 text-sm" onClick={() => {
          const presets: Record<string, RotationRole[]> = { gambock: ['defence'], semmellechner: ['defence', 'middle'], semellechner: ['defence', 'middle'], hasler: ['defence', 'attack'], hinterwallner: ['defence', 'attack'], baumann: ['middle', 'attack'], pundy: ['middle', 'attack'], bradaric: ['middle', 'attack'], fasching: ['attack'], elkabbani: ['attack'], elkabany: ['attack'] };
          const positions = { ...config.positions };
          players.filter(p => start.squadIds.includes(p.id)).forEach(p => {
            const key = (p.last_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (presets[key]) positions[p.id] = presets[key];
          });
          update({ ...config, positions });
        }}>Besprochene Positionen übernehmen</button>
        <div className="mt-3 space-y-3">
          {start.squadIds.filter(id => id !== start.slots.GK).map(id => <fieldset key={id} disabled={disabled} className="rounded-xl bg-white/5 p-3">
            <legend className="px-1 text-base font-bold">{name(id)}</legend>
            <div className="flex flex-wrap gap-3">{(Object.keys(rotationRoleLabels) as RotationRole[]).map(role => <label key={role} className="flex min-h-11 items-center gap-2 text-base"><input type="checkbox" checked={config.positions[id]?.includes(role) ?? false} onChange={e => {
              const roles = config.positions[id] ?? [];
              update({ ...config, positions: { ...config.positions, [id]: e.target.checked ? [...roles, role] : roles.filter(r => r !== role) } });
            }}/>{rotationRoleLabels[role]}</label>)}</div>
          </fieldset>)}
        </div>
      </details>
      {!games.some(g => g.match_id) ? <p className="text-base text-white/60">Positionen jetzt speichern. Sobald eigene Spiele vorhanden sind, den Durchspieler je Gruppenspiel wählen.</p> : null}
      {[...games].filter(g => g.match_id).sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at)).map(game => {
        const id = game.match_id!;
        const planned = config.games[id];
        const mode = planned?.mode ?? rotationModeForPhase(game.phase);
        const locked = disabled || applying || game.match_status !== 'upcoming';
        let invalid = '';
        if (planned?.frames) { try { validateRotationGame(planned, start, config.positions, game.planned_minutes); } catch (e) { invalid = (e as Error).message; } }
        const candidates = Object.values(start.slots).filter((p): p is string => Boolean(p && p !== start.slots.GK));
        const totals = planned?.frames ? rotationMinutes(planned.frames) : {};
        return <div key={id} className="space-y-3 rounded-xl border border-white/15 p-3">
          <h4 className="text-base font-bold">{game.opponent_name} · {game.planned_minutes} Min.</h4>
          {game.match_status !== 'upcoming' ? <p className="text-sm text-white/60">Gestartete und abgeschlossene Spiele behalten ihre eigene Planung.</p> : null}
          <label className="block space-y-1 text-base">Wechselmodus<select className={selectClass} disabled={locked} value={mode ?? ''} onChange={e => update({ ...config, games: { ...config.games, [id]: { mode: e.target.value as 'scheduled' | 'free' } } })}>
            <option value="" disabled>Spielphase auswählen</option><option value="scheduled">Gruppe · 2 Wechsel alle 3 Minuten</option><option value="free">Platzierung · frei wechseln</option>
          </select></label>
          {mode === 'scheduled' ? <>
            <label className="block space-y-1 text-base">Durchspielender Feldspieler<select className={selectClass} disabled={locked} value={planned?.anchorId ?? ''} onChange={e => update({ ...config, games: { ...config.games, [id]: { mode: 'scheduled', anchorId: e.target.value } } })}>
              <option value="">Bitte wählen</option>{candidates.map(playerId => {
                let possible = true;
                try { generateTournamentRotation(start, config.positions, playerId, game.planned_minutes); } catch { possible = false; }
                return <option key={playerId} value={playerId} disabled={!possible}>{name(playerId)}{possible ? '' : ' · Positionen passen nicht'}</option>;
              })}
            </select></label>
            <button type="button" disabled={locked || !planned?.anchorId} className="min-h-12 w-full rounded-xl border border-white/25 px-3 text-base font-bold disabled:opacity-40" onClick={() => {
              try {
                const frames = generateTournamentRotation(start, config.positions, planned!.anchorId!, game.planned_minutes);
                update({ ...config, games: { ...config.games, [id]: { mode: 'scheduled', anchorId: planned!.anchorId, frames } } });
              } catch (e) { setError((e as Error).message); }
            }}>Vier Spielabschnitte berechnen</button>
            {!planned?.frames ? <p className="text-sm text-amber-200">Vor der Übernahme einen passenden Durchspieler wählen und den Plan berechnen. Benötigt 5+1, 2–1–2, neun Feldspieler und 12 Minuten.</p> : null}
            {invalid ? <p role="alert" className="text-sm text-amber-200">{invalid}</p> : null}
            {planned?.frames && !invalid ? <>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="pb-2 text-left text-base font-bold">Alle vier Aufstellungen</caption><thead><tr><th className="p-2">Position</th>{planned.frames.map(f => <th className="p-2" key={f.minute}>{f.minute}–{f.minute + 3}’</th>)}</tr></thead><tbody>
                {U11_FORMATIONS[start.formationId].map(row => <tr key={row.slot}><th className="p-2">{row.label}</th>{planned.frames!.map(frame => <td className="p-2" key={frame.minute}>{name(frame.slots[row.slot]!)}</td>)}</tr>)}
              </tbody></table></div>
              <details><summary className="min-h-11 cursor-pointer py-2 text-base">Geplante Spielzeit</summary>{start.squadIds.map(playerId => <p key={playerId} className="flex justify-between gap-3 py-1 text-base"><span>{name(playerId)}</span><strong>{totals[playerId] ?? 0} Min.</strong></p>)}</details>
            </> : null}
          </> : <p className="text-base text-white/65">{mode === 'free' ? 'Startaufstellung übernehmen, danach nach Spielverlauf wechseln. Kein fester Durchspieler und kein Wechselcountdown.' : 'Unbekannte Spielphase: Wechselmodus bitte selbst auswählen.'}</p>}
          {game.has_lineup && game.match_status === 'upcoming' ? <button type="button" disabled={locked || Boolean(invalid) || !mode || (mode === 'scheduled' && !planned?.frames)} className="min-h-12 w-full rounded-xl border border-white/25 px-3 text-base font-bold disabled:opacity-40" onClick={async () => {
            setApplying(true); setError(''); setMessage('');
            try { await onApplyPrepared(game); setMessage(`Wechselplanung für ${game.opponent_name} gespeichert.`); }
            catch (e) { setError((e as Error).message); }
            finally { setApplying(false); }
          }}>Wechselplan für vorbereitetes Spiel speichern</button> : null}
        </div>;
      })}
      {error ? <p role="alert" className="text-base text-amber-200">{error}</p> : null}
      {message ? <p role="status" className="text-base text-emerald-300">{message}</p> : null}
      <p className="text-sm text-white/60">Positionen und Spielpläne werden gemeinsam mit der Grundaufstellung gespeichert. Geplante Minuten sind keine tatsächlichen Einsätze.</p>
    </> : null}
  </section>;
}
