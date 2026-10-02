import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Palette, X } from 'lucide-react';
import { MatchdayPosterCard, type MatchdayPosterCardProps } from './MatchdayPosterCard';
import { CLEAN_MATCHDAY_DESIGN, DEMO_MATCHDAY_DESIGNS, type MatchdayDesign } from '../../lib/matchdayDesign';
import { listRoster } from '../../lib/rosterService';
import { matchdayPosterDomToPngBlob } from '../../lib/matchdayPosterExport';

type Props = {
  design: MatchdayDesign;
  save: (design: MatchdayDesign) => Promise<void>;
  poster: MatchdayPosterCardProps;
  teamSeasonId: string;
  demo?: boolean;
  loading?: boolean;
  loadError?: string | null;
};

export function MatchdayDesignButton({ design, save, poster, teamSeasonId, demo = false, loading, loadError }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(design);
  const [choices, setChoices] = useState(DEMO_MATCHDAY_DESIGNS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    if (!demo) void listRoster(teamSeasonId, 'active').then(result => {
      if (!active) return;
      const players: MatchdayDesign[] = result.data.filter(p => p.cutout_url).map(p => ({
        template: 'player', playerId: p.id, imageUrl: p.cutout_url!, playerName: p.display_name,
      }));
      setChoices([...DEMO_MATCHDAY_DESIGNS, ...players]);
    });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setOpen(false); };
    window.addEventListener('keydown', key);
    return () => { active = false; window.removeEventListener('keydown', key); };
  }, [open, teamSeasonId, demo, busy]);
  const options = draft.template === 'player' && !choices.some(c => c.imageUrl === draft.imageUrl)
    ? [draft, ...choices] : choices;
  const download = async () => {
    if (!ref.current) return;
    setBusy(true); setError(null);
    try {
      const blob = await matchdayPosterDomToPngBlob(ref.current);
      if (!blob) throw new Error('Bild konnte nicht erstellt werden.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'spielzeit-spieltag.png'; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Export fehlgeschlagen.'); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" disabled={loading} onClick={() => { setDraft(design); setError(null); setOpen(true); }}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-black/50 px-3 text-sm font-semibold text-white disabled:opacity-50">
      <Palette className="h-4 w-4" aria-hidden />Vorlage & Vorschau
    </button>
    {open ? createPortal(<div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85 p-3" role="dialog" aria-modal="true" aria-labelledby="matchday-design-title">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-red-500/30 bg-[#100d11] text-white">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 id="matchday-design-title" className="text-lg font-bold">Autopost · Vorlage & Vorschau</h2>
          <button autoFocus type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Schließen" className="p-2"><X /></button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Vorlage wählen">
            {(['clean', 'player'] as const).map(template => <button key={template} type="button" aria-pressed={draft.template === template}
              onClick={() => setDraft(template === 'clean' ? CLEAN_MATCHDAY_DESIGN : options[0]!)}
              className={`min-h-[48px] rounded-xl border font-bold ${draft.template === template ? 'border-red-500 bg-red-900/60' : 'border-white/20'}`}>
              {template === 'clean' ? 'Ohne Spieler' : 'Mit Spieler'}
            </button>)}
          </div>
          {draft.template === 'player' ? <label className="mt-3 block text-sm font-semibold">Spielermotiv
            <select value={draft.imageUrl ?? ''} onChange={e => setDraft(options.find(c => c.imageUrl === e.target.value)!)} className="mt-2 min-h-[48px] w-full rounded-xl border border-white/20 bg-black p-3 text-base">
              {options.map(c => <option key={c.imageUrl} value={c.imageUrl!}>{c.playerName ?? 'Spielerfoto'}</option>)}
            </select>
          </label> : null}
          <p className="my-3 text-xs text-white/65">Auswahl gilt für dieses Spiel. Echte Spielerfotos nur mit entsprechender Freigabe verwenden. Demomotive sind fiktiv.</p>
          <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-xl" aria-label="Autopost-Vorschau">
            <MatchdayPosterCard {...poster} ref={ref} playerImageUrl={draft.template === 'player' ? draft.imageUrl : null} />
          </div>
          <button type="button" onClick={() => void download()} disabled={busy} className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/20"><Download className="h-4 w-4" />Vorschaubild herunterladen</button>
          {loadError || error ? <p role="alert" className="mt-3 text-sm text-red-300">{error ?? loadError}</p> : null}
          {demo ? <p className="mt-3 text-xs text-amber-200">Demo: Die Auswahl gilt nur hier während dieser Sitzung, ohne Datenbank-Schreibzugriff.</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-[48px] rounded-xl border border-white/20">Abbrechen</button>
          <button type="button" disabled={busy || Boolean(loadError)} onClick={async () => {
            setBusy(true); setError(null);
            try { await save(draft); setOpen(false); } catch(e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); }
            finally { setBusy(false); }
          }} className="min-h-[48px] rounded-xl bg-red-700 font-bold disabled:opacity-50">{busy ? 'Bitte warten…' : demo ? 'Demo übernehmen' : 'Für Spiel speichern'}</button>
        </div>
      </div>
    </div>, document.body) : null}
  </>;
}
