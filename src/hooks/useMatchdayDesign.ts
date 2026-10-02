import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CLEAN_MATCHDAY_DESIGN, parseMatchdayDesign, type MatchdayDesign } from '../lib/matchdayDesign';

const demoDesigns = new Map<string, MatchdayDesign>();
const CHANGE_EVENT = 'spielzeit-matchday-design-change';

export function useMatchdayDesign(eventId: string, teamSeasonId: string, demo = false) {
  const [design, setDesign] = useState<MatchdayDesign>(CLEAN_MATCHDAY_DESIGN);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setDesign(CLEAN_MATCHDAY_DESIGN);
      if (demo) {
        setDesign(demoDesigns.get(eventId) ?? CLEAN_MATCHDAY_DESIGN);
      } else if (eventId && teamSeasonId) {
        const { data, error } = await supabase.from('event_feed_settings')
          .select('matchday_design').eq('event_id', eventId).eq('team_season_id', teamSeasonId).maybeSingle();
        if (!active) return;
        if (error) setLoadError('Vorlagenauswahl konnte nicht geladen werden. Bitte erneut öffnen.');
        else setDesign(parseMatchdayDesign(data?.matchday_design));
      }
      if (active) setLoading(false);
    };
    void load();
    const change = (e: Event) => {
      const detail = (e as CustomEvent<{ eventId: string; design: MatchdayDesign }>).detail;
      if (detail?.eventId === eventId && active) setDesign(detail.design);
    };
    window.addEventListener(CHANGE_EVENT, change);
    return () => { active = false; window.removeEventListener(CHANGE_EVENT, change); };
  }, [eventId, teamSeasonId, demo]);

  const save = useCallback(async (next: MatchdayDesign) => {
    const normalized = parseMatchdayDesign(next);
    if (demo) demoDesigns.set(eventId, normalized);
    else {
      if (!eventId || !teamSeasonId) throw new Error('Spiel oder Mannschaft fehlt.');
      const { data, error } = await supabase.from('event_feed_settings').upsert({
        event_id: eventId, team_season_id: teamSeasonId, matchday_design: normalized,
      }, { onConflict: 'event_id' }).select('matchday_design').single();
      if (error) throw new Error(error.message);
      if (JSON.stringify(parseMatchdayDesign(data?.matchday_design)) !== JSON.stringify(normalized)) {
        throw new Error('Die Auswahl konnte nicht bestätigt werden.');
      }
    }
    setDesign(normalized);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { eventId, design: normalized } }));
  }, [eventId, teamSeasonId, demo]);
  return { design, loading, loadError, save };
}
