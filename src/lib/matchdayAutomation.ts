import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

const AUTH_WAIT_MS = 12_000;

/**
 * Wartet, bis der Supabase-Client eine User-Session hat (nach Refresh/INITIAL_SESSION).
 * Verhindert RPC-Aufrufe mit leerem JWT → auth.uid() NULL → not_authenticated.
 */
async function waitForClientSession(): Promise<Session | null> {
  const { data: { session: initial } } = await supabase.auth.getSession();
  if (initial?.user?.id) return initial;

  return await new Promise((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;

    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(t);
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
      resolve(session);
    };

    const t = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data: { session } }) => finish(session ?? null));
    }, AUTH_WAIT_MS);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) finish(session);
    });
    unsubscribe = () => data.subscription.unsubscribe();
  });
}

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
  rpcPayload: unknown | null;
  workerOk: boolean | null;
  workerStatus: number | null;
  workerSummary: string | null;
}> {
  if (!teamSeasonId?.trim()) {
    console.info('[matchday] (2) teamSeasonId = (leer) — kein RPC');
    return {
      rpcOk: false,
      rpcError: 'no_team_season',
      rpcPayload: null,
      workerOk: null,
      workerStatus: null,
      workerSummary: null,
    };
  }

  const session = await waitForClientSession();
  console.info('[matchday] (1) session user id (vor RPC) =', session?.user?.id ?? '(keine Session — RPC würde not_authenticated liefern)');

  if (!session?.user?.id) {
    console.warn('[matchday] skip (3) — kein RPC-Aufruf ohne Session');
    return {
      rpcOk: false,
      rpcError: 'no_client_session',
      rpcPayload: null,
      workerOk: null,
      workerStatus: null,
      workerSummary: null,
    };
  }

  console.info('[matchday] (3) calling rpc ensure_matchday_automation …', { p_team_season_id: teamSeasonId });
  const { data: rpcData, error: rpcErr } = await supabase.rpc('ensure_matchday_automation', {
    p_team_season_id: teamSeasonId,
  });

  if (rpcErr) {
    console.warn('[matchday] (4) rpc result = HTTP/Fehler:', rpcErr.message ?? rpcErr);
    console.warn('[matchday] (4) rpc result (raw error object) =', JSON.stringify(rpcErr, null, 2));
    return {
      rpcOk: false,
      rpcError: rpcErr.message ?? String(rpcErr),
      rpcPayload: null,
      workerOk: null,
      workerStatus: null,
      workerSummary: null,
    };
  }

  console.info('[matchday] (4) rpc result (JSON) =', JSON.stringify(rpcData, null, 2));
  console.info('[matchday] (4) rpc result (Objekt) =', rpcData);

  const payload = rpcData as { ok?: boolean; error?: string; skipped?: boolean; reason?: string } | null;
  if (payload && typeof payload === 'object' && payload.ok === false) {
    const err = payload.error ?? 'rpc_returned_ok_false';
    console.warn('[matchday] (4) RPC-Antwort ok:false →', err, payload);
    return {
      rpcOk: false,
      rpcError: err,
      rpcPayload: rpcData,
      workerOk: null,
      workerStatus: null,
      workerSummary: null,
    };
  }

  if (import.meta.env.VITE_MATCHDAY_PUSH_TEST !== 'true') {
    return {
      rpcOk: true,
      rpcError: null,
      rpcPayload: rpcData,
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
      rpcPayload: rpcData,
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
      rpcPayload: rpcData,
      workerOk: false,
      workerStatus: null,
      workerSummary: msg,
    };
  }
}
