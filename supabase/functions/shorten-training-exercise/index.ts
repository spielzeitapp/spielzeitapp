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

const DANGLING_SENTENCE_END = /\b(?:nur|sowie|beziehungsweise|und|oder|mit|in|auf|für|von|zu|nach|vor|bei|durch|der|die|das|den|dem|einem|einer)$/i;

function hasCompleteSentence(value: string): boolean {
  const normalized = value.trim();
  if (!/[.!?]$/.test(normalized) || /…|\.\.\.$/.test(normalized)) return false;
  return !DANGLING_SENTENCE_END.test(normalized.replace(/[.!?]+$/, '').trim());
}

function appendWithinLimit(base: string, line: string, limit: number): string {
  if (!line) return base;
  const next = base ? `${base}\n${line}` : line;
  return next.length <= limit ? next : base;
}

function originalVariations(value: unknown): string[] {
  const raw = sourceText(value);
  if (!raw) return [];

  const labelled = [...raw.matchAll(
    /(?:^|\n|\s)(?:Variation|Variante)\s*\d+\s*:\s*([\s\S]*?)(?=(?:\n|\s)(?:Variation|Variante)\s*\d+\s*:|$)/gi,
  )].map((match) => match[1]);
  const candidates = labelled.length > 0
    ? labelled
    : raw
      .replace(/^Variationen?\s*:\s*/i, '')
      .split(/\n+|\s*;\s*/);

  return candidates
    .map((variation) => cleanOutput(variation)
      .replace(/^[-•]\s*/, '')
      .replace(/^(?:Variation|Variante)\s*\d*\s*:\s*/i, '')
      .replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, 3)
    .map((variation) => /[.!?]$/.test(variation) ? variation : `${variation}.`);
}

type RequiredRule = {
  label: string;
  source: RegExp;
  result: RegExp;
};

const REQUIRED_FLOW_RULES: RequiredRule[] = [
  {
    label: 'Spiel ohne Abseits',
    source: /\bohne\s+abseits\b/i,
    result: /\bohne\s+abseits\b/i,
  },
  {
    label: 'Anspieler darf nach dem Einspielen nicht mehr angespielt werden',
    source: /darf\s+danach\s+nicht\s+mehr\s+angespielt\s+werden|danach\s+nicht\s+mehr\s+anspielbar/i,
    result: /darf\s+danach\s+nicht\s+mehr\s+angespielt\s+werden|danach\s+(?:nicht\s+mehr\s+anspielbar|gesperrt)|ist\s+danach\s+gesperrt/i,
  },
  {
    label: 'Anspieler hat zwei Kontakte',
    source: /anspieler[\s\S]{0,100}(?:zwei|2)\s+kontakte|(?:zwei|2)\s+kontakte[\s\S]{0,100}anspieler/i,
    result: /anspieler[\s\S]{0,100}(?:zwei|2)\s+kontakte|(?:zwei|2)\s+kontakte[\s\S]{0,100}anspieler/i,
  },
  {
    label: 'Wandspieler spielen direkt',
    source: /wandspieler[\s\S]{0,80}\bdirekt\w*|\bdirekt\w*[\s\S]{0,80}wandspieler/i,
    result: /wandspieler[\s\S]{0,80}\bdirekt\w*|\bdirekt\w*[\s\S]{0,80}wandspieler/i,
  },
  {
    label: 'Nach Tor oder Ausball sofort neuer Ball',
    source: /tor[\s\S]{0,50}ausball|ausball[\s\S]{0,50}tor/i,
    result: /(?=[\s\S]*\btor\b)(?=[\s\S]*\baus(?:ball)?\b)(?=[\s\S]*\bsofort\b)(?=[\s\S]*\bneu\w*\s+ball\b)/i,
  },
  {
    label: 'Nach Balleroberung zuerst zum Anspieler passen',
    source: /(?:erobert|ballgewinn|balleroberung)[\s\S]{0,180}(?:erst|zuerst)[\s\S]{0,80}anspieler/i,
    result: /(?:erobert|gewinnt|ballgewinn|balleroberung)[\s\S]{0,140}(?:erst|zuerst)[\s\S]{0,60}anspieler/i,
  },
  {
    label: 'Nach dem Zuspiel Spielrichtung wechseln und angreifen',
    source: /spielrichtung[\s\S]{0,100}(?:angreif|angriff)|(?:angreif|angriff)[\s\S]{0,100}spielrichtung/i,
    result: /(?:spielrichtung|richtungswechsel|richtung\s+wechsel)[\s\S]{0,100}(?:angreif|angriff)|(?:angreif|angriff)[\s\S]{0,100}(?:spielrichtung|richtungswechsel|richtung\s+wechsel)/i,
  },
  {
    label: 'Aufgaben nach jedem Durchgang tauschen',
    source: /nach\s+jedem\s+durchgang[\s\S]{0,80}(?:wechsel|tausch)/i,
    result: /nach\s+jedem\s+durchgang[\s\S]{0,80}(?:wechsel|tausch)|(?:wechsel|tausch)[\s\S]{0,80}nach\s+jedem\s+durchgang/i,
  },
];

function missingRequiredRules(sourceValue: unknown, resultValue: string): string[] {
  const source = sourceText(sourceValue);
  const result = cleanOutput(resultValue);
  const missing = REQUIRED_FLOW_RULES
    .filter((rule) => rule.source.test(source) && !rule.result.test(result))
    .map((rule) => rule.label);

  for (const color of ['Rot', 'Blau', 'Grün', 'Gelb']) {
    if (source.toLocaleLowerCase('de-AT').includes(color.toLocaleLowerCase('de-AT'))
      && !result.toLocaleLowerCase('de-AT').includes(color.toLocaleLowerCase('de-AT'))) {
      missing.push(`Rolle/Farbe ${color}`);
    }
  }
  return missing;
}

function normaliseResult(value: unknown, sourceVariationText: unknown): ShortText | null {
  if (!value || typeof value !== 'object') return null;
  const result = value as Partial<AiShortText>;
  if (
    typeof result.setup !== 'string' ||
    typeof result.flow !== 'string' ||
    typeof result.materials !== 'string' ||
    !Array.isArray(result.coachingPoints) ||
    !result.coachingPoints.every((item) => typeof item === 'string')
  ) {
    return null;
  }

  let content = '';
  const setup = cleanOutput(result.setup);
  const flow = cleanOutput(result.flow);
  if (
    (setup && !hasCompleteSentence(setup))
    || (flow && !hasCompleteSentence(flow))
  ) return null;
  if (setup) content = appendWithinLimit(content, `Aufbau: ${setup}`, LIMITS.content);
  if (flow) content = appendWithinLimit(content, `Ablauf: ${flow}`, LIMITS.content);
  for (const [index, variation] of originalVariations(sourceVariationText).entries()) {
    content = appendWithinLimit(
      content,
      `Variation ${index + 1}: ${variation}`,
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

    const variationBudget = originalVariations(input.variations)
      .reduce((total, variation, index) => total + variation.length + `Variation ${index + 1}: `.length + 1, 0);
    const flowLimit = Math.max(340, Math.min(500, LIMITS.content - 140 - variationBudget));
    let missingRules: string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const attemptFlowLimit = Math.max(320, flowLimit - (attempt > 0 ? 20 : 0));
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
            'Bewahre die fachliche Bedeutung. Erfinde, ergänze oder vertausche keine Details.',
            'Gib nur setup, flow, materials und coachingPoints getrennt zurück. Variationen werden unverändert aus dem Original übernommen und dürfen nicht von dir ausgegeben werden.',
            'setup: höchstens 110 Zeichen und nur die nötige Feldorganisation aus organisation.',
            `flow: höchstens ${attemptFlowLimit} Zeichen aus ablauf (dem Feld Kurzbeschreibung). Bewahre Spieler- und Farbrollen, Spielrichtung, Aktionen, Reihenfolge sowie Aufgaben- und Positionswechsel.`,
            'Unterscheide Balleroberung und Ballverlust exakt. Vertausche niemals, welches Team verteidigt, den Ball gewinnt, zuerst zum Anspieler passen muss oder danach angreift.',
            'Wenn im Original vorhanden, müssen Kontaktbegrenzungen, die Sperre des Anspielers nach dem Einspielen, der sofortige neue Ball nach Tor oder Ausball und der Aufgabenwechsel nach dem Durchgang im Ablauf stehen.',
            'materials: höchstens 100 Zeichen, nur eine kompakte kommagetrennte Materialliste.',
            'coachingPoints: zwei bis vier kurze Einträge ausschließlich aus coachingpunkte und niemals aus variationen.',
            'Keine Auslassungspunkte, keine abgebrochenen Sätze, keine URLs, keine Quellenangaben.',
            'Formuliere grammatikalisch korrekt und eindeutig. Schreibe zum Beispiel „Erobert Rot den Ball“ und nicht „Ball erobert Rot“.',
            'Jeder Text in setup und flow muss mit einem vollständigen Satz und einem Punkt, Fragezeichen oder Rufzeichen enden.',
            attempt > 0 ? 'Die erste Antwort war unvollständig. Formuliere alle Sätze diesmal kürzer und grammatikalisch vollständig.' : '',
            attempt > 0 && missingRules.length > 0
              ? `Diese Pflichtangaben fehlten oder waren falsch und müssen diesmal ausdrücklich enthalten sein: ${missingRules.join('; ')}.`
              : '',
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
                  setup: { type: 'string', maxLength: 120 },
                  flow: { type: 'string', maxLength: 520 },
                  materials: { type: 'string', maxLength: LIMITS.materials },
                  coachingPoints: {
                    type: 'array',
                    minItems: 0,
                    maxItems: 4,
                    items: { type: 'string', maxLength: 100 },
                  },
                },
                required: ['setup', 'flow', 'materials', 'coachingPoints'],
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
        console.error('[shorten-training-exercise] Invalid structured output', { attempt: attempt + 1 });
        continue;
      }

      const normalised = normaliseResult(result, input.variations);
      missingRules = normalised
        ? missingRequiredRules(source.ablauf, normalised.content)
        : [];
      if (normalised && missingRules.length === 0) return json(normalised);
      console.error(
        '[shorten-training-exercise] Structured output could not be normalised',
        { attempt: attempt + 1 },
        { missingRules },
        JSON.stringify(result).slice(0, 1_000),
      );
    }
    return json({ error: 'Die KI-Kurzfassung enthielt auch nach einem zweiten Versuch nicht alle Pflichtregeln.' }, 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[shorten-training-exercise]', message);
    return json({ error: 'Die KI-Kurzfassung konnte nicht erstellt werden.' }, 500);
  }
});
