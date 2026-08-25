export type TrainingExerciseShortTextInput = {
  description?: string | null;
  organization?: string | null;
  materials?: string | null;
  coachingPoints?: string | null;
  variations?: string | null;
};

export type TrainingExerciseShortText = {
  content: string;
  materials: string;
  coaching: string;
};

export const TRAINING_SHORT_TEXT_LIMITS = {
  content: 270,
  materials: 100,
  coaching: 250,
} as const;

function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function withoutBullet(value: string): string {
  return value.replace(/^\s*(?:[-–—•*]|\d+[.)])\s*/, '').trim();
}

function splitThoughts(value: unknown): string[] {
  const text = clean(value)
    .replace(/\bz\.\s*B\./gi, 'zum Beispiel')
    .replace(/\bca\./gi, 'etwa')
    .replace(/\bbzw\./gi, 'beziehungsweise')
    .replace(/\bu\.\s*a\./gi, 'unter anderem')
    .replace(/\bggf\./gi, 'gegebenenfalls');
  if (!text) return [];
  const parts = text
    .split(/\n+|\s+[–—]\s+|(?<=[.!?;])\s+(?=[A-ZÄÖÜ0-9])/)
    .flatMap((part) => part.split(/\s*;\s*/))
    .map(withoutBullet)
    .map((part) => part.replace(/[.;,\s]+$/, '').trim())
    .filter((part) => part.length >= 3 && !/^video\s*:/i.test(part));
  const merged: string[] = [];
  for (const part of parts) {
    const previous = merged.at(-1);
    if (previous && (previous.match(/\(/g)?.length ?? 0) > (previous.match(/\)/g)?.length ?? 0)) {
      merged[merged.length - 1] = `${previous}; ${part}`;
    } else {
      merged.push(part);
    }
  }
  return merged;
}

function phraseWithin(value: string, max: number): string {
  const normalized = value.replace(/[….,;:\s]+$/, '').trim();
  if (normalized.length <= max) return normalized;

  const slice = normalized.slice(0, max + 1);
  const phraseBoundary = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('; '),
    slice.lastIndexOf(', '),
    slice.lastIndexOf(': '),
    slice.lastIndexOf(' – '),
    slice.lastIndexOf(' - '),
  );
  const wordBoundary = slice.lastIndexOf(' ');
  const boundary = phraseBoundary > max * 0.25
    ? phraseBoundary
    : wordBoundary > max * 0.55
      ? wordBoundary
      : max;
  let shortened = slice.slice(0, boundary).replace(/[….,;:\s]+$/, '').trim();
  if ((shortened.match(/\(/g)?.length ?? 0) > (shortened.match(/\)/g)?.length ?? 0)) {
    shortened = shortened.slice(0, shortened.lastIndexOf('(')).trim();
  }
  while (/\b(?:und|oder|mit|in|auf|für|von|zu|nach|vor|bei|durch|der|die|das|den|dem|einem|einer)$/i.test(shortened)) {
    shortened = shortened.replace(/\s+\S+$/, '').trim();
  }
  return shortened;
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLocaleLowerCase('de-AT').replace(/[^a-z0-9äöüß]+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function bullets(items: string[], limit: number, maxItems: number, maxItemLength: number): string {
  const result: string[] = [];
  for (const original of unique(items)) {
    if (result.length >= maxItems) break;
    const remaining = limit - result.join('\n').length - (result.length ? 1 : 0);
    if (remaining < 18) break;
    const item = phraseWithin(original, Math.min(remaining - 2, maxItemLength));
    if (item) result.push(`• ${item}`);
  }
  return result.join('\n');
}

function labeledContent(organization: string[], description: string[]): string {
  const candidates = [
    { label: 'Aufbau', value: organization[0] },
    { label: 'Start', value: description[0] },
    { label: 'Ablauf', value: description[1] },
    { label: 'Wechsel', value: description[2] },
  ].filter((candidate): candidate is { label: string; value: string } => Boolean(candidate.value));
  const result: string[] = [];
  for (const candidate of candidates) {
    const used = result.join('\n').length + (result.length ? 1 : 0);
    const remaining = TRAINING_SHORT_TEXT_LIMITS.content - used;
    const prefix = `${candidate.label}: `;
    if (remaining <= prefix.length + 12) break;
    const value = phraseWithin(candidate.value, Math.min(88, remaining - prefix.length));
    if (value) result.push(`${prefix}${value}`);
  }
  return result.join('\n');
}

function compactMaterials(value: unknown): string {
  const parts = clean(value)
    .split(/\n|,|;/)
    .map(withoutBullet)
    .map((part) => part.trim())
    .filter(Boolean);
  const result: string[] = [];
  for (const part of unique(parts)) {
    const candidate = [...result, part].join(', ');
    if (candidate.length > TRAINING_SHORT_TEXT_LIMITS.materials) break;
    result.push(part);
  }
  return result.join(', ') || phraseWithin(parts[0] ?? '', TRAINING_SHORT_TEXT_LIMITS.materials);
}

/**
 * Erstellt einen kompakten, aber weiterhin verständlichen Trainer-Spickzettel.
 * Der ausführliche Ursprungstext wird dabei nicht verändert.
 */
export function createTrainingExerciseShortText(
  input: TrainingExerciseShortTextInput,
): TrainingExerciseShortText {
  const organization = splitThoughts(input.organization).map((item) => item.replace(/^aufbau\s*:\s*/i, ''));
  const description = splitThoughts(input.description);
  const coachingPoints = splitThoughts(input.coachingPoints);
  const variations = splitThoughts(input.variations).map((item) => `Variation: ${item}`);
  const coachingItems = variations.length > 0
    ? [...coachingPoints.slice(0, 3), variations[0]]
    : coachingPoints.slice(0, 4);
  const content = labeledContent(organization, description);
  const coaching = bullets(
    coachingItems,
    TRAINING_SHORT_TEXT_LIMITS.coaching,
    4,
    78,
  );

  return {
    content,
    materials: compactMaterials(input.materials),
    coaching,
  };
}

export function createTrainingExerciseOriginalText(
  input: TrainingExerciseShortTextInput,
): TrainingExerciseShortText {
  const organization = clean(input.organization).replace(/^aufbau\s*:\s*/i, '');
  const description = clean(input.description).replace(/^ablauf\s*:\s*/i, '');
  const variations = clean(input.variations).replace(/^variationen?\s*:\s*/i, '');
  return {
    content: [
      organization ? `Aufbau: ${organization}` : '',
      description ? `Ablauf: ${description}` : '',
    ].filter(Boolean).join('\n'),
    materials: clean(input.materials),
    coaching: [
      clean(input.coachingPoints),
      variations ? `Variationen: ${variations}` : '',
    ].filter(Boolean).join('\n'),
  };
}

export function preferredTrainingExerciseShortText(
  shortValue: string | null | undefined,
  fallbackValue: string | null | undefined,
): string {
  return clean(shortValue) || clean(fallbackValue);
}

export function resolveTrainingExerciseShortText(
  exercise: TrainingExerciseShortTextInput & {
    shortContent?: string | null;
    shortMaterials?: string | null;
    shortCoaching?: string | null;
  },
): TrainingExerciseShortText {
  const generated = createTrainingExerciseShortText(exercise);
  return {
    content: preferredTrainingExerciseShortText(exercise.shortContent, generated.content),
    materials: preferredTrainingExerciseShortText(exercise.shortMaterials, generated.materials),
    coaching: preferredTrainingExerciseShortText(exercise.shortCoaching, generated.coaching),
  };
}
