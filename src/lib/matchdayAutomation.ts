import { supabase } from './supabaseClient';

/**
 * Idempotent: RPC legt höchstens einen Matchday-Feed-Post pro Event an (Dedupe-Key in DB).
 * Zeitfenster: Kalendertag vor dem Spiel + optional Catch-up am Spieltag (Europe/Vienna).
 *
 * Push-Versand ist absichtlich kein Kernprodukt: nur wenn VITE_MATCHDAY_PUSH_TEST === 'true'
 * wird nach dem RPC die Worker-Route /api/send-reminders getriggert (lokal oft nicht erreichbar).
 */
export async function ensureMatchdayFeedPostForSeason(teamSeasonId: string): Promise<{
  rpcOk: boolean;
  rpcError: string | null;
  workerOk: boolean | null;
  workerStatus: number | null;
  workerSummary: string | null;
}> {
  const { error: rpcErr } = await supabase.rpc('ensure_matchday_automation', {
    p_team_season_id: teamSeasonId,
  });

  if (rpcErr) {
    console.warn('[matchdayAutomation] ensure_matchday_automation', rpcErr.message ?? rpcErr);
    return {
      rpcOk: false,
      rpcError: rpcErr.message ?? String(rpcErr),
      workerOk: null,
      workerStatus: null,
      workerSummary: null,
    };
  }

  if (import.meta.env.VITE_MATCHDAY_PUSH_TEST !== 'true') {
    return {
      rpcOk: true,
      rpcError: null,
      workerOk: null,
      workerStatus: null,
      workerSummary: null,
    };
  }

  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '');
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}${base}/api/send-reminders`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'matchday_push_test' }),
    });
    let summary: string | null = null;
    try {
      const j = (await res.json()) as {
        ok?: boolean;
        message?: string;
        processed?: number;
        sent?: number;
        failed?: number;
        error?: string;
      };
      if (j && typeof j === 'object') {
        summary = [
          j.message,
          typeof j.processed === 'number' ? `processed=${j.processed}` : null,
          typeof j.sent === 'number' ? `sent=${j.sent}` : null,
          typeof j.failed === 'number' ? `failed=${j.failed}` : null,
          j.error,
        ]
          .filter(Boolean)
          .join(' · ');
      }
    } catch {
      summary = `HTTP ${res.status}`;
    }
    if (!res.ok) {
      console.warn('[matchdayAutomation] send-reminders (test)', res.status, summary);
    } else {
      console.info('[matchdayAutomation] send-reminders (test)', summary);
    }
    return {
      rpcOk: true,
      rpcError: null,
      workerOk: res.ok,
      workerStatus: res.status,
      workerSummary: summary,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[matchdayAutomation] send-reminders fetch failed (test)', msg);
    return {
      rpcOk: true,
      rpcError: null,
      workerOk: false,
      workerStatus: null,
      workerSummary: msg,
    };
  }
}
