import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIMITS = { content: 760, materials: 100, coaching: 250 } as const;
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

type FactChecklist = {
  setupFacts: string[];
  flowFacts: string[];
  variationFacts: string[];
};

type FactVerification = {
  valid: boolean;
  missingFacts: string[];
  contradictions: string[];
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

async function structuredAiCall(
  openAiKey: string,
  model: string,
  name: string,
  instructions: string[],
  input: unknown,
  schema: Record<string, unknown>,
): Promise<{ value: unknown | null; apiError: boolean }> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: instructions.filter(Boolean).join('\n'),
      input: JSON.stringify(input),
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name,
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    console.error(`[shorten-training-exercise] OpenAI error (${name})`, response.status, detail);
    return { value: null, apiError: true };
  }

  const payload = (await response.json()) as Record<string, unknown>;
  try {
    return { value: JSON.parse(outputText(payload)), apiError: false };
  } catch {
    console.error(`[shorten-training-exercise] Invalid structured output (${name})`);
    return { value: null, apiError: false };
  }
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

function completeSentenceEnding(value: string, maxLength: number): string {
  const normalized = cleanOutput(value).replace(/\s+/g, ' ');
  if (!normalized || hasCompleteSentence(normalized)) return normalized;
  const withoutEnding = normalized.replace(/[,:;]+$/, '').trimEnd();
  if (!withoutEnding || DANGLING_SENTENCE_END.test(withoutEnding)) return normalized;
  return withoutEnding.length < maxLength ? `${withoutEnding}.` : normalized;
}

function normaliseGeneratedSentenceEndings(value: unknown, setupLimit: number, flowLimit: number, variationItemLimit: number): unknown {
  if (!value || typeof value !== 'object') return value;
  const result = value as Partial<AiShortText>;
  return {
    ...result,
    setup: typeof result.setup === 'string'
      ? completeSentenceEnding(result.setup, setupLimit)
      : result.setup,
    flow: typeof result.flow === 'string'
      ? completeSentenceEnding(result.flow, flowLimit)
      : result.flow,
    variations: Array.isArray(result.variations)
      ? result.variations.map((variation) => typeof variation === 'string'
        ? completeSentenceEnding(variation, variationItemLimit)
        : variation)
      : result.variations,
  };
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

function stringList(value: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null;
  return value
    .map((item) => cleanOutput(item).replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normaliseChecklist(value: unknown): FactChecklist | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<FactChecklist>;
  const setupFacts = stringList(candidate.setupFacts, 6);
  const flowFacts = stringList(candidate.flowFacts, 20);
  const variationFacts = stringList(candidate.variationFacts, 16);
  if (!setupFacts || !flowFacts || !variationFacts) return null;
  return { setupFacts, flowFacts, variationFacts };
}

function normaliseVerification(value: unknown): FactVerification | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<FactVerification>;
  const missingFacts = stringList(candidate.missingFacts, 24);
  const contradictions = stringList(candidate.contradictions, 16);
  if (typeof candidate.valid !== 'boolean' || !missingFacts || !contradictions) return null;
  return { valid: candidate.valid, missingFacts, contradictions };
}

function normalisationIssues(value: unknown, expectedVariationCount: number): string[] {
  if (!value || typeof value !== 'object') return ['Die Antwort hat nicht das erwartete Format'];
  const result = value as Partial<AiShortText>;
  const issues: string[] = [];
  if (typeof result.setup !== 'string') issues.push('Der Aufbau fehlt');
  if (typeof result.flow !== 'string') issues.push('Der Ablauf fehlt');
  if (!Array.isArray(result.variations) || !result.variations.every((item) => typeof item === 'string')) {
    issues.push('Die Variationen haben nicht das erwartete Format');
  } else if (result.variations.length !== expectedVariationCount) {
    issues.push(`Genau ${expectedVariationCount} Variationen in der ursprünglichen Reihenfolge ausgeben`);
  }
  if (typeof result.materials !== 'string') issues.push('Die Geräteliste fehlt');
  if (!Array.isArray(result.coachingPoints) || !result.coachingPoints.every((item) => typeof item === 'string')) {
    issues.push('Die Coachingpunkte haben nicht das erwartete Format');
  }
  if (issues.length > 0) return issues;

  const setup = cleanOutput(result.setup as string);
  const flow = cleanOutput(result.flow as string);
  const variations = (result.variations as string[]).map((variation) => cleanOutput(variation));
  if (setup && !hasCompleteSentence(setup)) issues.push('Aufbau mit einem vollständigen Satz abschließen');
  if (flow && !hasCompleteSentence(flow)) issues.push('Ablauf mit einem vollständigen Satz abschließen');
  variations.forEach((variation, index) => {
    if (!variation || !hasCompleteSentence(variation)) {
      issues.push(`Variation ${index + 1} mit einem vollständigen Satz abschließen`);
    }
  });

  const contentLines = [
    setup ? `Aufbau: ${setup}` : '',
    flow ? `Ablauf: ${flow}` : '',
    ...variations.map((variation, index) => `Variation ${index + 1}: ${variation}`),
  ].filter(Boolean);
  const contentLength = contentLines.join('\n').length;
  if (contentLength > LIMITS.content) {
    issues.push(`Aufbau und Ablauf um mindestens ${contentLength - LIMITS.content + 15} Zeichen kürzen`);
  }
  if ((result.materials as string).length > LIMITS.materials) issues.push('Geräteliste kürzen');
  return issues;
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
  const variations = result.variations.map((variation) => cleanOutput(variation));
  if (
    (setup && !hasCompleteSentence(setup))
    || (flow && !hasCompleteSentence(flow))
    || variations.some((variation) => !variation || !hasCompleteSentence(variation))
  ) return null;
  if (setup) content = appendWithinLimit(content, `Aufbau: ${setup}`, LIMITS.content);
  if (flow) content = appendWithinLimit(content, `Ablauf: ${flow}`, LIMITS.content);
  if ((setup && !content.includes('Aufbau:')) || (flow && !content.includes('Ablauf:'))) return null;
  for (const [index, variation] of variations.entries()) {
    const next = appendWithinLimit(content, `Variation ${index + 1}: ${variation}`, LIMITS.content);
    if (next === content) return null;
    content = next;
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
    const model = (Deno.env.get('OPENAI_SHORTEN_MODEL') ?? 'gpt-4.1').trim();

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
    const aiSource = {
      organisation: source.organisation,
      ablauf: source.ablauf,
      variationen: source.variationen,
      geraete: source.geraete,
      coachingpunkte: source.coachingpunkte,
    };

    const variations = originalVariations(input.variations);
    const variationCount = variations.length;
    const setupLimit = 90;
    const variationItemLimit = variationCount === 1 ? 110 : variationCount === 2 ? 100 : 65;
    const variationBudget = variations.reduce(
      (total, _variation, index) => total + variationItemLimit + `Variation ${index + 1}: `.length + 1,
      0,
    );
    const reservedSetupBudget = 'Aufbau: '.length + setupLimit + 1 + 'Ablauf: '.length;
    const flowLimit = Math.min(500, LIMITS.content - reservedSetupBudget - variationBudget);
    // Keep one character free so completeSentenceEnding can add a missing final
    // punctuation mark without exceeding the actual PDF field limits.
    const setupGenerationLimit = Math.max(1, setupLimit - 1);
    const flowGenerationLimit = Math.max(1, flowLimit - 1);
    const variationGenerationLimit = Math.max(1, variationItemLimit - 1);
    const checklistResponse = await structuredAiCall(
      openAiKey,
      model,
      'training_exercise_fact_checklist',
      [
        'Du analysierst eine beliebige Fußballübung und extrahierst ihre unverzichtbaren Fakten.',
        'Nenne nur Tatsachen, die ausdrücklich im Original stehen. Erfinde oder interpretiere nichts hinzu.',
        'Die Faktenliste ist eine Priorisierung für eine Kurzfassung mit insgesamt 760 Zeichen. Nicht jeder Satz und nicht jedes Beispiel aus dem Original ist eine Pflichtinformation.',
        'setupFacts enthält höchstens sechs notwendige Fakten zum räumlichen oder materiellen Aufbau.',
        'flowFacts enthält höchstens zwanzig atomare Pflichtfakten, die für die praktische Durchführung wirklich unverzichtbar sind.',
        'Erfasse jede ausdrücklich genannte Rolle, Farbe, Position, Reihenfolge, Lauf- und Passaktion, Kontaktzahl, Spielfortsetzung, Wertung, Seiten-, Positions- und Aufgabenänderung sowie jede erlaubte oder verbotene Aktion.',
        'Bedingungen wie „nach Tor“, „bei Ausball“ oder „nach Ballgewinn“ sind jeweils eigene Pflichtfakten und dürfen nicht weggelassen oder zusammengezogen werden.',
        'Fasse nur sprachlich zusammen. Ursache, Zeitpunkt, Reihenfolge, Zuständigkeit und Zuordnung müssen vollständig erhalten bleiben.',
        'variationFacts enthält höchstens sechzehn atomare Pflichtfakten aus den Variationen. Jede genannte Variation und ihre spielentscheidenden Bedingungen müssen erfasst werden.',
        'Redundanzen, Begründungen, Beispiele und rein sprachliche Details dürfen entfallen. Wähle nur Fakten, deren Weglassen die Durchführung oder Regelwirkung verändern würde.',
        'Material und Coachingpunkte gehören nicht in diese Faktenliste.',
      ],
      { organisation: source.organisation, ablauf: source.ablauf, variationen: variations },
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          setupFacts: {
            type: 'array',
            minItems: 0,
            maxItems: 6,
            items: { type: 'string', maxLength: 160 },
          },
          flowFacts: {
            type: 'array',
            minItems: 0,
            maxItems: 20,
            items: { type: 'string', maxLength: 180 },
          },
          variationFacts: {
            type: 'array',
            minItems: 0,
            maxItems: 16,
            items: { type: 'string', maxLength: 180 },
          },
        },
        required: ['setupFacts', 'flowFacts', 'variationFacts'],
      },
    );
    if (checklistResponse.apiError) {
      return json({ error: 'Die KI konnte momentan keine Kurzfassung erstellen.' }, 502);
    }
    const checklist = normaliseChecklist(checklistResponse.value);
    if (
      !checklist
      || (source.ablauf && checklist.flowFacts.length === 0)
      || (variationCount > 0 && checklist.variationFacts.length === 0)
    ) {
      console.error('[shorten-training-exercise] Dynamic fact checklist was invalid');
      return json({ error: 'Die KI konnte die Pflichtinformationen dieser Übung nicht sicher bestimmen.' });
    }

    const flowTarget = Math.max(180, flowLimit - 35);
    let correctionNotes: string[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const generationResponse = await structuredAiCall(
        openAiKey,
        model,
        'training_exercise_short_text',
        [
          'Du bist Fußballtrainer und erstellst einen verständlichen Spickzettel für den Trainingsplatz.',
          'Bewahre die fachliche Bedeutung. Erfinde, ergänze oder vertausche keine Details.',
          'Jeder Eintrag aus mustKeepFacts muss semantisch eindeutig im zugehörigen Bereich setup, flow oder variations enthalten sein.',
          'Gib nur setup, flow, variations, materials und coachingPoints getrennt zurück.',
          `setup: höchstens ${setupGenerationLimit} Zeichen inklusive Satzzeichen und nur die nötige Feldorganisation.`,
          `flow: Ziel sind etwa ${flowTarget} Zeichen, höchstens ${flowGenerationLimit} Zeichen inklusive Satzzeichen. Beende den letzten Satz deutlich vor der Höchstgrenze.`,
          `variations: genau ${variationCount} kurze Einträge in derselben Reihenfolge wie im Original; jeder höchstens ${variationGenerationLimit} Zeichen inklusive Satzzeichen. Bewahre alle Bedingungen, erfinde nichts und lasse keine Originalvariation weg.`,
          'Nutze kurze, grammatikalisch vollständige Sätze und übliche Fußballbegriffe. Rollen, Reihenfolge, Zuständigkeiten und Wechsel müssen eindeutig bleiben.',
          'materials: höchstens 100 Zeichen, nur eine kompakte kommagetrennte Materialliste.',
          'coachingPoints: zwei bis vier kurze Einträge ausschließlich aus den ursprünglichen Coachingpunkten.',
          'Keine Auslassungspunkte, keine abgebrochenen Sätze, keine URLs und keine Quellenangaben.',
          'Jeder Text in setup, flow und variations muss mit Punkt, Fragezeichen oder Rufzeichen enden.',
          correctionNotes.length > 0
            ? `Die unabhängige Prüfung beanstandete zuvor: ${correctionNotes.join('; ')}. Korrigiere genau diese Punkte.`
            : '',
          'Die Übung muss allein anhand der Kurzfassung und der Skizze praktisch durchführbar sein.',
        ],
        {
          source: aiSource,
          mustKeepFacts: checklist,
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            setup: { type: 'string', maxLength: setupGenerationLimit },
            flow: { type: 'string', maxLength: flowGenerationLimit },
            variations: {
              type: 'array',
              minItems: variationCount,
              maxItems: variationCount,
              items: { type: 'string', maxLength: variationGenerationLimit },
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
      );
      if (generationResponse.apiError) {
        return json({ error: 'Die KI konnte momentan keine Kurzfassung erstellen.' }, 502);
      }

      const generatedValue = normaliseGeneratedSentenceEndings(
        generationResponse.value,
        setupLimit,
        flowLimit,
        variationItemLimit,
      );
      const candidate = generatedValue && typeof generatedValue === 'object'
        ? generatedValue as Partial<AiShortText>
        : null;
      const formatIssues = normalisationIssues(generatedValue, variationCount);
      const normalised = formatIssues.length === 0
        ? normaliseResult(generatedValue)
        : null;
      if (!normalised || !candidate || typeof candidate.setup !== 'string' || typeof candidate.flow !== 'string') {
        correctionNotes = formatIssues.length > 0
          ? formatIssues
          : ['Aufbau und Ablauf vollständig innerhalb des Zeichenlimits formulieren'];
        console.error(
          '[shorten-training-exercise] Generated summary could not be normalised',
          {
            attempt: attempt + 1,
            correctionNotes,
            flowLimit,
            variationCount,
            variationItemLimit,
          },
        );
        continue;
      }

      const verificationResponse = await structuredAiCall(
        openAiKey,
        model,
        'training_exercise_fact_verification',
        [
          'Du prüfst eine Kurzfassung einer beliebigen Fußballübung gegen die priorisierten Pflichtfakten.',
          'Akzeptiere sinngetreue Kurzformen, Synonyme, Abkürzungen und andere grammatikalische Formulierungen.',
          'mustKeepFacts ist die verbindliche Liste der Informationen, die in der Kurzfassung erhalten bleiben müssen.',
          'Das vollständige Original dient nur dazu, Widersprüche oder erfundene Angaben zu erkennen. Details aus dem Original, die nicht in mustKeepFacts stehen, dürfen bewusst entfallen und sind kein Ablehnungsgrund.',
          'valid ist wahr, wenn alle mustKeepFacts semantisch eindeutig enthalten sind, jede Originalvariation in derselben Reihenfolge vertreten ist und die Kurzfassung dem Original nicht widerspricht.',
          'Trage in missingFacts ausschließlich tatsächlich fehlende Einträge aus mustKeepFacts oder eine vollständig fehlende Originalvariation ein.',
          'Prüfe jede Variation einzeln. Eine kürzere Formulierung ist ausdrücklich erlaubt; nur eine fehlende Pflichtbedingung, neue Regel oder zusammengelegte Variation ist abzulehnen.',
          'Trage erfundene, vertauschte oder widersprüchliche Aussagen knapp in contradictions ein.',
          'Lehne die Kurzfassung nicht wegen weggelassener Beispiele, Erklärungen, Wiederholungen, Stilfragen oder nicht priorisierter Details ab.',
          'Prüfe nicht Stil, Zeichenzahl, Material oder Coachingpunkte.',
        ],
        {
          source: { organisation: source.organisation, ablauf: source.ablauf, variations },
          mustKeepFacts: checklist,
          candidate: { setup: candidate.setup, flow: candidate.flow, variations: candidate.variations },
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            valid: { type: 'boolean' },
            missingFacts: {
              type: 'array',
              minItems: 0,
              maxItems: 24,
              items: { type: 'string', maxLength: 180 },
            },
            contradictions: {
              type: 'array',
              minItems: 0,
              maxItems: 16,
              items: { type: 'string', maxLength: 180 },
            },
          },
          required: ['valid', 'missingFacts', 'contradictions'],
        },
      );
      if (verificationResponse.apiError) {
        return json({ error: 'Die KI konnte die Kurzfassung momentan nicht abschließend prüfen.' }, 502);
      }
      const verification = normaliseVerification(verificationResponse.value);
      if (verification?.valid && verification.missingFacts.length === 0 && verification.contradictions.length === 0) {
        return json(normalised);
      }

      correctionNotes = verification
        ? [...verification.missingFacts, ...verification.contradictions]
        : ['Die unabhängige Faktenprüfung konnte nicht abgeschlossen werden'];
      console.error(
        '[shorten-training-exercise] Dynamic fact verification rejected summary',
        { attempt: attempt + 1, correctionNotes },
      );
    }
    return json({ error: 'Die KI war erreichbar, konnte aber keine gegen das Original geprüfte Kurzfassung erstellen.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[shorten-training-exercise]', message);
    return json({ error: 'Die KI-Kurzfassung konnte nicht erstellt werden.' }, 500);
  }
});
