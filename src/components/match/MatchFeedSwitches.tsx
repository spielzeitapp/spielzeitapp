import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Flags = { master: boolean; matchday: boolean; squad: boolean; lineup: boolean; result: boolean };
const defaults: Flags = { master: true, matchday: true, squad: true, lineup: true, result: true };
const labels: Record<keyof Flags, string> = {
  master: 'Automatische Feed-Beiträge', matchday: 'Spieltag', squad: 'Kader', lineup: 'Startaufstellung', result: 'Ergebnis',
};

/** One persisted set of switches, shared by match centre and preparation. */
export function MatchFeedSwitches({ eventId, matchId }: { eventId?: string; matchId?: string }) {
  const [context, setContext] = useState<{ id: string; team_season_id: string; match_id: string | null } | null>(null);
  const [flags, setFlags] = useState<Flags>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const generation = useRef(0);
  const lock = useRef(false);
  useEffect(() => {
    const token = ++generation.current;
    setLoading(true); setContext(null); setError(null); setSaved(false);
    void (async () => {
      try {
        const query = supabase.from('events').select('id, team_season_id, match_id');
        const { data: event, error: eventError } = await (eventId ? query.eq('id', eventId) : query.eq('match_id', matchId ?? '')).limit(1).single();
        if (eventError || !event) throw new Error(eventError?.message || 'Spiel nicht gefunden.');
        const [settings, match] = await Promise.all([
          supabase.from('event_feed_settings').select('feed_automation_enabled, squad_feed_enabled, lineup_feed_enabled, result_feed_enabled').eq('event_id', event.id).maybeSingle(),
          event.match_id ? supabase.from('matches').select('auto_matchday_feed_enabled').eq('id', event.match_id).single() : Promise.resolve({ data: null, error: null }),
        ]);
        if (settings.error || match.error) throw new Error(settings.error?.message || match.error?.message);
        if (token !== generation.current) return;
        setContext(event);
        setFlags({ master: settings.data?.feed_automation_enabled !== false, matchday: match.data?.auto_matchday_feed_enabled !== false,
          squad: settings.data?.squad_feed_enabled !== false, lineup: settings.data?.lineup_feed_enabled !== false, result: settings.data?.result_feed_enabled !== false });
      } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : String(e)); }
      finally { if (token === generation.current) setLoading(false); }
    })();
    return () => { generation.current++; };
  }, [eventId, matchId]);

  async function toggle(key: keyof Flags) {
    if (!context || lock.current) return;
    lock.current = true; setSaving(true); setError(null); setSaved(false);
    const token = generation.current;
    const value = !flags[key];
    try {
      if (key === 'matchday') {
        if (!context.match_id) throw new Error('Das Spiel ist noch nicht vorbereitet.');
        const { data, error } = await supabase.from('matches').update({ auto_matchday_feed_enabled: value }).eq('id', context.match_id).select('id').single();
        if (error || !data) throw new Error(error?.message || 'Speichern fehlgeschlagen.');
      } else {
        const columns = { master: 'feed_automation_enabled', squad: 'squad_feed_enabled', lineup: 'lineup_feed_enabled', result: 'result_feed_enabled' };
        const { data, error } = await supabase.from('event_feed_settings').upsert({ event_id: context.id, team_season_id: context.team_season_id, [columns[key]]: value }, { onConflict: 'event_id' }).select('id').single();
        if (error || !data) throw new Error(error?.message || 'Speichern fehlgeschlagen.');
      }
      if (token === generation.current) { setFlags(previous => ({ ...previous, [key]: value })); setSaved(true); }
    } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { lock.current = false; setSaving(false); }
  }

  return <section className="rounded-2xl border border-red-400/20 bg-black/25 p-4" aria-label="Automatische Feed-Beiträge">
    <h2 className="text-base font-bold text-white">Automatische Feed-Beiträge</h2>
    <p className="mt-1 text-xs text-white/55">Für dieses Spiel. Änderungen werden sofort gespeichert.</p>
    {loading ? <p className="mt-3 text-sm text-white/65">Einstellungen werden geladen…</p> : <>
      {(['master', 'matchday', 'squad', 'lineup', 'result'] as const).map(key => {
        const disabled = saving || !context || (key !== 'master' && !flags.master) || (key === 'matchday' && !context?.match_id);
        return <label key={key} className={`flex min-h-[52px] items-center justify-between gap-3 border-b border-white/10 py-2 last:border-0 ${key === 'master' ? 'mt-2 font-bold' : 'pl-3'} ${disabled ? 'opacity-45' : 'cursor-pointer'}`}>
          <span className="text-sm text-white">{key === 'master' ? 'Alle Autoposts' : labels[key]}</span>
          <span className="relative shrink-0">
            <input type="checkbox" role="switch" checked={flags[key]} disabled={disabled} onChange={() => void toggle(key)} aria-label={labels[key]}
              className="peer sr-only" />
            <span aria-hidden="true" className={`block h-6 w-11 rounded-full p-0.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-white ${flags[key] ? 'bg-red-600' : 'bg-white/20'}`}>
              <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${flags[key] ? 'translate-x-5' : ''}`} />
            </span>
          </span>
        </label>;
      })}
      <p className="mt-3 text-xs leading-relaxed text-white/55">{flags.master ? 'Die ausgewählten Beiträge werden automatisch erstellt.' : 'Alle automatischen Feed-Beiträge sind aus. Deine Einzelauswahl bleibt gespeichert.'} Kadernachrichten an Eltern und Spieler bleiben aktiv.</p>
    </>}
    {saving ? <p role="status" className="mt-2 text-xs text-white/60">Speichern…</p> : saved ? <p role="status" className="mt-2 text-xs text-emerald-300">Gespeichert</p> : null}
    {error ? <p role="alert" className="mt-2 text-xs text-red-300">{error}</p> : null}
  </section>;
}
