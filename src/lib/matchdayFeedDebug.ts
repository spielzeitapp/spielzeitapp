import { supabase } from './supabaseClient';

const VIENNA = 'Europe/Vienna';

/** Kalendertag in Europe/Vienna als YYYY-MM-DD (wie RPC date-Vergleiche). */
export function matchdayViennaYmd(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIENNA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function isMatchLikeRow(kind: string | null | undefined, type: string | null | undefined): boolean {
  const k = (kind ?? '').trim().toLowerCase();
  const t = (type ?? '').trim().toLowerCase();
  return k === 'match' || t === 'match' || t === 'game';
}

function addDaysToViennaYmd(todayYmd: string, days: number): string {
  const [y, m, d] = todayYmd.split('-').map(Number);
  const baseUtcNoon = Date.UTC(y, m - 1, d, 12, 0, 0);
  const end = new Date(baseUtcNoon + days * 86400000);
  return matchdayViennaYmd(end);
}

/**
 * Browser-Konsole: Session + Events der Saison mit Wien-Datum (Abgleich mit RPC-Fenster).
 * Kein UI; nur console.*
 */
export async function logMatchdayFeedSeasonContext(teamSeasonId: string): Promise<void> {
  console.info('[matchday] ========== Matchday-Feed Diagnose (Events / Wien) ==========');
  console.info('[matchday] (2) teamSeasonId (Feed = RPC p_team_season_id) =', teamSeasonId);

  const todayV = matchdayViennaYmd(new Date());
  const endV = addDaysToViennaYmd(todayV, 14);
  console.info('[matchday] (2b) Wien-Kalender: today =', todayV, '| RPC-Fenster Ende (+14d) ≈', endV);

  const { data: events, error } = await supabase
    .from('events')
    .select('id, team_season_id, starts_at, kind, type, status')
    .eq('team_season_id', teamSeasonId)
    .order('starts_at', { ascending: true })
    .limit(40);

  if (error) {
    console.warn('[matchday] (2c) events query error:', error.message ?? error);
    console.info('[matchday] ========== Ende Diagnose ==========');
    return;
  }

  const list = events ?? [];
  const matchLike = list.filter((e) =>
    isMatchLikeRow(
      (e as { kind?: string }).kind,
      (e as { type?: string }).type,
    ),
  );

  console.info('[matchday] (2c) events in dieser Saison (max 40):', list.length, '| match-artig:', matchLike.length);

  for (const raw of matchLike.slice(0, 12)) {
    const e = raw as {
      id: string;
      team_season_id: string;
      starts_at: string;
      kind?: string | null;
      type?: string | null;
      status?: string | null;
    };
    const vd = matchdayViennaYmd(e.starts_at);
    const sameSeason = e.team_season_id === teamSeasonId;
    const st = (e.status ?? '').toLowerCase();
    const okStatus = st !== 'canceled' && (st === 'upcoming' || st === 'live');
    const inWindow = vd >= todayV && vd <= endV;
    const isMorgen = vd === addDaysToViennaYmd(todayV, 1);
    const isHeute = vd === todayV;
    console.info('[matchday] (2d) Spiel-Kandidat', {
      event_id: e.id,
      team_season_id: e.team_season_id,
      gleiche_team_season_id_wie_Feed: sameSeason,
      starts_at_utc: e.starts_at,
      vienna_datum: vd,
      heute_wien: isHeute,
      morgen_wien: isMorgen,
      im_rpc_fenster_heute_bis_14d: inWindow,
      kind: e.kind,
      type: e.type,
      status: e.status,
      rpc_status_ok: okStatus,
    });
  }

  if (matchLike.length > 12) {
    console.info('[matchday] (2d) … weitere match-artige Events ausgeblendet (>12)');
  }

  console.info('[matchday] — (1)(3)(4) folgen beim RPC in matchdayAutomation —');
}
