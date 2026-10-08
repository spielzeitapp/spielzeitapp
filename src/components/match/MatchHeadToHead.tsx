import React, { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { getClubLogo, getOurTeamDisplayName, PLACEHOLDER_LOGO } from '../../lib/teamLogos';
import { filterHeadToHead, summarizeHeadToHead, type HeadToHeadMatch } from '../../lib/headToHead';

type Props = {
  matchId: string; teamSeasonId: string; ownTeamName?: string; opponentName?: string;
  ownLogoSrc?: string; opponentLogoSrc?: string; canManage?: boolean;
};
const dateFormat = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna' });
function Logo({ src }: { src: string }) {
  return <img src={src} alt="" className="h-10 w-10 shrink-0 object-contain" onError={e => {
    if (!e.currentTarget.src.endsWith(PLACEHOLDER_LOGO)) e.currentTarget.src = PLACEHOLDER_LOGO;
  }} />;
}

/** Only result metadata is confirmed; historical scores and archive state stay untouched. */
export function MatchHeadToHead({ matchId, teamSeasonId, ownTeamName = getOurTeamDisplayName(), opponentName,
  ownLogoSrc, opponentLogoSrc, canManage = false }: Props) {
  const [matches, setMatches] = useState<HeadToHeadMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [season, setSeason] = useState('');
  const [venue, setVenue] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => { setSeason(''); setVenue('all'); setExpanded(false); setShowInfo(false); setSaveError(null); }, [matchId]);
  useEffect(() => {
    let canceled = false;
    setLoading(true); setError(false);
    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_match_head_to_head', { p_match_id: matchId });
        if (canceled) return;
        if (rpcError || !Array.isArray(data)) { setError(true); return; }
        setMatches(data as HeadToHeadMatch[]);
      } catch { if (!canceled) setError(true); }
      finally { if (!canceled) setLoading(false); }
    })();
    return () => { canceled = true; };
  }, [matchId, retry]);
  const seasons = useMemo(() => [...new Map(matches.map(m => [m.team_season_id, m.season_name])).entries()], [matches]);
  const filtered = useMemo(() => filterHeadToHead(matches, season, venue), [matches, season, venue]);
  const summary = summarizeHeadToHead(filtered);
  const settled = summary.wins + summary.draws + summary.losses;
  const visible = expanded ? filtered : filtered.slice(0, 5);
  const opponent = opponentName || matches[0]?.opponent || 'Gegner';
  const selectClass = 'min-h-11 min-w-0 w-full rounded-xl border border-white/15 bg-zinc-950 px-2 text-xs text-white';
  async function confirm(m: HeadToHeadMatch, side: boolean | null) {
    if (saving || !canManage) return;
    setSaving(m.id); setSaveError(null);
    try {
      const { error: rpcError } = await supabase.rpc('confirm_head_to_head_result', {
        p_context_match_id: matchId, p_history_match_id: m.id, p_team_score_home: side,
        p_expected_score_home: m.stored_score_home, p_expected_score_away: m.stored_score_away,
      });
      if (rpcError) throw rpcError;
      setRetry(n => n + 1);
    } catch { setSaveError('Bestätigung nicht gespeichert. Bitte neu laden und erneut versuchen.'); }
    finally { setSaving(null); }
  }
  return <section aria-label="Direkter Vergleich" className="rounded-2xl border border-white/10 bg-black/40 p-3 sm:p-4">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-white">Direkter Vergleich</h2>
      <button type="button" aria-label="Informationen zum direkten Vergleich" aria-expanded={showInfo} onClick={() => setShowInfo(v => !v)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10"><Info size={18} /></button>
    </div>
    <p className="text-[11px] text-white/55">Aus Sicht von {ownTeamName} · inklusive Archiv</p>
    {showInfo && <p className="mt-2 rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-white/65">Verglichen werden abgeschlossene Spiele derselben Mannschaft aus allen gespeicherten Saisonen. Gegner werden anhand ihrer Vereinskennung oder eindeutig gleicher Namen erkannt. Abweichende Vereinsnamen werden nicht automatisch zusammengeführt. Unbestätigte 0:0-Ergebnisse und unklare Teamzuordnungen zählen erst nach Trainerbestätigung zur Bilanz. Alle Ergebnisse unten stehen aus unserer Sicht.</p>}
    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="flex min-w-0 flex-col items-center gap-1 text-center"><Logo src={ownLogoSrc || getClubLogo(ownTeamName)} /><p className="break-words text-xs font-semibold text-white">{ownTeamName}</p></div>
      <span className="text-xs font-bold text-white/35">VS</span>
      <div className="flex min-w-0 flex-col items-center gap-1 text-center"><Logo src={opponentLogoSrc || getClubLogo(opponent)} /><p className="break-words text-xs font-semibold text-white">{opponent}</p></div>
    </div>
    {loading ? <p className="mt-3 text-sm text-white/60" role="status">Vergleich wird geladen…</p>
      : error ? <div className="mt-3 text-sm text-white/60" role="status">Vergleich momentan nicht verfügbar.
        <button type="button" onClick={() => setRetry(n => n + 1)} className="ml-2 min-h-11 font-semibold text-white underline">Erneut versuchen</button>
      </div> : <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select aria-label="Saison für direkten Vergleich" className={selectClass} value={season} onChange={e => { setSeason(e.target.value); setExpanded(false); }}>
          <option value="">Alle Saisonen</option><option value={teamSeasonId}>Saison dieses Spiels</option>
          {seasons.filter(([id]) => id !== teamSeasonId).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label="Heim oder Auswärts" className={selectClass} value={venue} onChange={e => { setVenue(e.target.value); setExpanded(false); }}>
          <option value="all">Heim &amp; Auswärts</option><option value="home">Heim</option><option value="away">Auswärts</option>
        </select>
      </div>
      {filtered.length === 0 ? <p className="mt-3 text-sm text-white/60">Keine abgeschlossenen direkten Duelle für diese Auswahl gespeichert.</p> : <>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { value: summary.wins, label: 'Siege', color: 'text-emerald-300', background: 'bg-emerald-400/5' },
            { value: summary.draws, label: 'Unentschieden', color: 'text-white/85', background: 'bg-white/5' },
            { value: summary.losses, label: 'Niederlagen', color: 'text-red-300', background: 'bg-red-400/5' },
          ].map(({ value, label, color, background }) => <div key={label} className={`rounded-xl border border-white/10 px-1 py-2 ${background}`}><p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p><p className="text-[10px] text-white/65">{label}</p></div>)}
        </div>
        <div aria-hidden="true" className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/10">
          {settled > 0 && <><span className="bg-emerald-400" style={{ width: `${summary.wins / settled * 100}%` }} /><span className="bg-zinc-400" style={{ width: `${summary.draws / settled * 100}%` }} /><span className="bg-red-400" style={{ width: `${summary.losses / settled * 100}%` }} /></>}
        </div>
        <p className="mt-2 text-center text-xs text-white/70">{summary.total} {summary.total === 1 ? 'Duell' : 'Duelle'} · {settled > 0 ? <>Tore <strong className="tabular-nums text-white">{summary.goals}:{summary.conceded}</strong></> : 'Noch keine bestätigte Bilanz'}</p>
        {summary.unresolved > 0 && <p className="mt-2 text-[11px] leading-relaxed text-amber-200/90">{summary.unresolved} {summary.unresolved === 1 ? 'Ergebnis offen – zählt' : 'Ergebnisse offen – zählen'} noch nicht zur Bilanz.</p>}
        <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-white/70">Bisherige Begegnungen</h3>
        <ul className="mt-1 divide-y divide-white/10">
          {visible.map(m => {
            const resolved = m.result_verified !== false && m.side_known !== false && m.team_goals != null && m.opponent_goals != null;
            const outcome = resolved ? m.team_goals! > m.opponent_goals! ? 'Sieg' : m.team_goals! < m.opponent_goals! ? 'Niederlage' : 'Unentschieden' : 'Offen';
            const color = outcome === 'Sieg' ? 'text-emerald-300' : outcome === 'Niederlage' ? 'text-red-300' : outcome === 'Offen' ? 'text-amber-200' : 'text-white/85';
            const stored = m.stored_score_home != null && m.stored_score_away != null;
            return <li key={m.id} className="py-3">
              <p className="text-[10px] text-white/50">{dateFormat.format(new Date(m.match_date))} · {m.season_name} · {m.is_tournament ? 'Turnier' : m.is_home === true ? 'Heim' : m.is_home === false ? 'Auswärts' : 'Spielort offen'}</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="min-w-0 break-words text-xs font-semibold text-white">{ownTeamName}<span className="my-0.5 block text-[10px] font-normal text-white/40">gegen</span>{m.opponent}</p>
                <div className={`shrink-0 text-right ${color}`}><strong className="text-xl tabular-nums">{resolved ? `${m.team_goals}:${m.opponent_goals}` : '—'}</strong><p className="text-[10px]">{outcome}</p></div>
              </div>
              {!resolved && <p className="mt-2 text-[10px] text-white/55">{m.side_known === false ? `Gespeichert: ${m.stored_score_home ?? '—'}:${m.stored_score_away ?? '—'} · Torzuordnung fehlt.` : 'Gespeichert: 0:0 · Endstand noch nicht bestätigt.'}</p>}
              {canManage && stored && (!resolved || (m.is_home == null && !m.is_tournament)) && <details className="mt-1 text-xs text-white/70">
                <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-amber-200">{resolved ? 'Torzuordnung ändern' : 'Ergebnis prüfen'}</summary>
                <p className="mb-1 text-[11px] leading-relaxed">{(m.is_home == null && !m.is_tournament) ? `Welche Tore gehören zu ${ownTeamName}? Mit der Auswahl bestätigst du den gespeicherten Endstand.` : 'Nur bestätigen, wenn dieses Spiel tatsächlich 0:0 endete.'}</p>
                <div className="flex flex-wrap gap-2">
                  {(m.is_home == null && !m.is_tournament) ? [true, false].map(side => <button key={String(side)} type="button" disabled={saving !== null} onClick={() => void confirm(m, side)} className="min-h-11 rounded-xl border border-white/15 px-3 text-[11px] disabled:opacity-50">Unsere Tore {side ? 'links' : 'rechts'} ({side ? m.stored_score_home : m.stored_score_away})</button>) : <button type="button" disabled={saving !== null} onClick={() => void confirm(m, null)} className="min-h-11 rounded-xl border border-white/15 px-3 text-[11px] disabled:opacity-50">0:0 als Endstand bestätigen</button>}
                </div>
                {saving === m.id && <p role="status" className="mt-1">Wird gespeichert…</p>}
              </details>}
            </li>;
          })}
        </ul>
        {saveError && <p role="alert" className="text-xs text-red-300">{saveError}</p>}
        {filtered.length > 5 && <button type="button" onClick={() => setExpanded(v => !v)} className="min-h-11 w-full text-sm font-semibold text-white underline">{expanded ? 'Weniger anzeigen' : `Alle ${filtered.length} Duelle anzeigen`}</button>}
      </>}
    </>}
  </section>;
}
