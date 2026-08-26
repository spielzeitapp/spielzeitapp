import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIMITS = { content: 700, materials: 100, coaching: 250 } as const;
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

type AiShortText = {
  setup: string;
  flow: string;
  variations: string[];
  materials: string;
  coachingPoints: string[];
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

function cleanOutput(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/…|\.\.\./g, '.')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function appendWithinLimit(base: string, line: string, limit: number): string {
  if (!line) return base;
  const next = base ? `${base}\n${line}` : line;
  return next.length <= limit ? next : base;
}

function normaliseResult(value: unknown): ShortText | null {
  if (!value || typeof value !== 'object') return null;
  const result = value as Partial<AiShortText>;
  if (
    typeof result.setup !== 'string' ||
    typeof result.flow !== 'string' ||
    !Array.isArray(result.variations) ||
    !result.variations.every((item) => typeof item === 'string') ||
    typeof result.materials !== 'string' ||
    !Array.isArray(result.coachingPoints) ||
    !result.coachingPoints.every((item) => typeof item === 'string')
  ) {
    return null;
  }

  let content = '';
  const setup = cleanOutput(result.setup);
  const flow = cleanOutput(result.flow);
  if (setup) content = appendWithinLimit(content, `Aufbau: ${setup}`, LIMITS.content);
  if (flow) content = appendWithinLimit(content, `Ablauf: ${flow}`, LIMITS.content);
  for (const [index, variation] of result.variations.slice(0, 3).entries()) {
    content = appendWithinLimit(
      content,
      `Variation ${index + 1}: ${cleanOutput(variation)}`,
      LIMITS.content,
    );
  }

  let coaching = '';
  for (const point of result.coachingPoints.slice(0, 4)) {
    const cleaned = cleanOutput(point);
    if (!cleaned || /\bVariationen?\b/i.test(cleaned)) continue;
    coaching = appendWithinLimit(coaching, `• ${cleaned.replace(/^•\s*/, '')}`, LIMITS.coaching);
  }

  const materials = cleanOutput(result.materials);
  if (
    !content ||
    content.length > LIMITS.content ||
    materials.length > LIMITS.materials ||
    coaching.length > LIMITS.coaching
  ) {
    return null;
  }

  return { content, materials, coaching };
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
          'Gib setup, flow, variations, materials und coachingPoints getrennt zurück.',
          'setup: höchstens 130 Zeichen und nur die nötige Feldorganisation aus organisation.',
          'flow: höchstens 430 Zeichen aus ablauf (dem Feld Kurzbeschreibung). Bewahre Spieler- und Farbrollen, entscheidende Spielregeln, Aktionen, Positionswechsel sowie Wechsel nach Tor oder Ballverlust.',
          'variations: höchstens drei kurze Einträge aus variationen. Ergänze mindestens die wichtigste Variation, wenn eine vorhanden ist; weitere nur, wenn nach Aufbau und Ablauf noch Platz bleibt.',
          'materials: höchstens 100 Zeichen, nur eine kompakte kommagetrennte Materialliste.',
          'coachingPoints: zwei bis vier kurze Einträge ausschließlich aus coachingpunkte und niemals aus variationen.',
          'Keine Auslassungspunkte, keine abgebrochenen Sätze, keine URLs, keine Quellenangaben.',
          'Dauer und Spielerzahl nur nennen, wenn sie zum Verständnis zwingend erforderlich sind.',
          'Die Übung muss allein anhand der Kurzfassung und der Skizze praktisch durchführbar sein.',
        ].join('\n'),
        input: JSON.stringify(source),
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: 'training_exercise_short_text',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                setup: { type: 'string', maxLength: 130 },
                flow: { type: 'string', maxLength: 430 },
                variations: {
                  type: 'array',
                  maxItems: 3,
                  items: { type: 'string', maxLength: 100 },
                },
                materials: { type: 'string', maxLength: LIMITS.materials },
                coachingPoints: {
                  type: 'array',
                  minItems: 0,
                  maxItems: 4,
                  items: { type: 'string', maxLength: 100 },
                },
              },
              required: ['setup', 'flow', 'variations', 'materials', 'coachingPoints'],
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

    const normalised = normaliseResult(result);
    if (!normalised) {
      console.error(
        '[shorten-training-exercise] Structured output could not be normalised',
        JSON.stringify(result).slice(0, 1_000),
      );
      return json({ error: 'Die KI-Kurzfassung konnte nicht passend zusammengesetzt werden.' }, 502);
    }
    return json(normalised);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[shorten-training-exercise]', message);
    return json({ error: 'Die KI-Kurzfassung konnte nicht erstellt werden.' }, 500);
  }
});
