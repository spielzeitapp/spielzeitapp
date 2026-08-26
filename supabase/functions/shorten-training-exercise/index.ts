import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIMITS = { content: 300, materials: 100, coaching: 250 } as const;
const MAX_SOURCE_LENGTH = 8_000;

type SourceInput = {
  description?: unknown;
  organization?: unknown;
  materials?: unknown;
  coachingPoints?: unknown;
  variations?: unknown;
};

type RequestBody = {
  clubId?: unknown;
  input?: SourceInput;
};

type ShortText = {
  content: string;
  materials: string;
  coaching: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sourceText(value: unknown): string {
  return String(value ?? '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, MAX_SOURCE_LENGTH);
}

function outputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
    }
  }
  return '';
}

function validResult(
  value: unknown,
  source: { organisation?: string; ablauf?: string },
): value is ShortText {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<ShortText>;
  return (
    typeof result.content === 'string' &&
    result.content.length <= LIMITS.content &&
    typeof result.materials === 'string' &&
    result.materials.length <= LIMITS.materials &&
    typeof result.coaching === 'string' &&
    result.coaching.length <= LIMITS.coaching &&
    (!source.organisation || /(?:^|\n)Aufbau:/i.test(result.content)) &&
    (!source.ablauf || /(?:^|\n)Ablauf:/i.test(result.content)) &&
    !/\bVariationen?\b/i.test(result.coaching) &&
    !/…|\.\.\./.test(`${result.content}${result.materials}${result.coaching}`)
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Nicht angemeldet.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const openAiKey = (Deno.env.get('OPENAI_API_KEY') ?? '').trim();
    const model = (Deno.env.get('OPENAI_SHORTEN_MODEL') ?? 'gpt-4.1-mini').trim();

    if (!supabaseUrl || !supabaseAnon) return json({ error: 'Supabase ist nicht vollständig konfiguriert.' }, 500);
    if (!openAiKey) return json({ error: 'Die KI-Kurzfassung ist noch nicht konfiguriert.' }, 503);

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Nicht angemeldet.' }, 401);

    const body = (await req.json()) as RequestBody;
    const clubId = typeof body.clubId === 'string' ? body.clubId.trim() : '';
    if (!clubId) return json({ error: 'Verein fehlt.' }, 400);

    const { data: canManage, error: permissionError } = await userClient.rpc(
      'can_manage_club_venues',
      { p_club_id: clubId },
    );
    if (permissionError || !canManage) return json({ error: 'Keine Berechtigung für diesen Verein.' }, 403);

    const input = body.input ?? {};
    const source = {
      organisation: sourceText(input.organization),
      ablauf: sourceText(input.description),
      geraete: sourceText(input.materials),
      coachingpunkte: sourceText(input.coachingPoints),
      variationen: sourceText(input.variations),
    };
    if (!Object.values(source).some(Boolean)) return json({ error: 'Kein Übungstext zum Kürzen vorhanden.' }, 400);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: [
          'Du bist Fußballtrainer und erstellst einen verständlichen Spickzettel für den Trainingsplatz.',
          'Bewahre die fachliche Bedeutung. Erfinde keine Details.',
          'content: höchstens 300 Zeichen insgesamt, in dieser Reihenfolge: Aufbau:, Ablauf: und optional Variation 1: bis höchstens Variation 3:.',
          'Ablauf stammt aus ablauf (dem Feld Kurzbeschreibung) und hat höchste Priorität. Bewahre die entscheidenden Spielregeln, Aktionen sowie Wechsel nach Tor oder Ballverlust.',
          'Aufbau enthält nur die nötige Feldorganisation. Nenne bis zu drei Variationen nur, wenn danach noch genug Platz für einen verständlichen Ablauf bleibt.',
          'materials: höchstens 100 Zeichen, nur eine kompakte kommagetrennte Materialliste.',
          'coaching: höchstens 250 Zeichen, zwei bis vier klare Aufzählungspunkte mit dem Zeichen •. Verwende ausschließlich coachingpunkte und niemals Variationen.',
          'Keine Auslassungspunkte, keine abgebrochenen Sätze, keine URLs, keine Quellenangaben.',
          'Dauer und Spielerzahl nur nennen, wenn sie zum Verständnis zwingend erforderlich sind.',
          'Die Übung muss allein anhand der Kurzfassung und der Skizze praktisch durchführbar sein.',
        ].join('\n'),
        input: JSON.stringify(source),
        text: {
          format: {
            type: 'json_schema',
            name: 'training_exercise_short_text',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                content: { type: 'string', maxLength: LIMITS.content },
                materials: { type: 'string', maxLength: LIMITS.materials },
                coaching: { type: 'string', maxLength: LIMITS.coaching },
              },
              required: ['content', 'materials', 'coaching'],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error('[shorten-training-exercise] OpenAI error', response.status, detail);
      return json({ error: 'Die KI konnte momentan keine Kurzfassung erstellen.' }, 502);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const raw = outputText(payload);
    let result: unknown;
    try {
      result = JSON.parse(raw);
    } catch {
      console.error('[shorten-training-exercise] Invalid structured output');
      return json({ error: 'Die KI-Antwort konnte nicht verarbeitet werden.' }, 502);
    }

    if (!validResult(result, source)) {
      return json({ error: 'Die KI-Kurzfassung hält die vorgegebenen Textlängen nicht ein.' }, 502);
    }
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[shorten-training-exercise]', message);
    return json({ error: 'Die KI-Kurzfassung konnte nicht erstellt werden.' }, 500);
  }
});
