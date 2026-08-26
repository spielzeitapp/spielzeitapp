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
  content: 700,
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

function splitVariations(value: unknown): string[] {
  const text = clean(value).replace(/^variationen?\s*:\s*/i, '');
  if (!text) return [];
  return unique(
    text
      .split(/\n+|\s*;\s*/)
      .map(withoutBullet)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3 && !/^video\s*:/i.test(part)),
  ).slice(0, 3);
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

function labeledContent(
  organization: string[],
  description: string[],
  variations: string[],
): string {
  const result: string[] = [];
  const append = (label: string, value: string, maxLength: number): boolean => {
    if (!value) return false;
    const used = result.join('\n').length + (result.length ? 1 : 0);
    const remaining = TRAINING_SHORT_TEXT_LIMITS.content - used;
    const prefix = `${label}: `;
    if (remaining <= prefix.length + 12) return false;
    const shortened = phraseWithin(value, Math.min(maxLength, remaining - prefix.length));
    if (!shortened) return false;
    result.push(`${prefix}${shortened}`);
    return true;
  };

  append('Aufbau', organization.join('. '), 130);
  const remainingBeforeAblauf =
    TRAINING_SHORT_TEXT_LIMITS.content - result.join('\n').length - (result.length ? 1 : 0);
  const variationReserve = variations.length > 0 ? 110 : 0;
  append(
    'Ablauf',
    description.join('. '),
    Math.max(180, Math.min(430, remainingBeforeAblauf - 'Ablauf: '.length - variationReserve)),
  );
  variations.slice(0, 3).forEach((variation, index) => {
    append(`Variation ${index + 1}`, variation, 100);
  });
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
export function createCompactTrainingExerciseShortText(
  input: TrainingExerciseShortTextInput,
): TrainingExerciseShortText {
  const organization = splitThoughts(input.organization).map((item) => item.replace(/^aufbau\s*:\s*/i, ''));
  const description = splitThoughts(input.description);
  const coachingPoints = splitThoughts(input.coachingPoints);
  const variations = splitVariations(input.variations);
  const content = labeledContent(organization, description, variations);
  const coaching = bullets(
    coachingPoints,
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

/**
 * Übernimmt den vollständigen Text, solange alle zentralen Feldgrenzen eingehalten
 * werden. Erst bei einem Überlauf wird ohne KI kompakt zusammengefasst.
 */
export function createTrainingExerciseShortText(
  input: TrainingExerciseShortTextInput,
): TrainingExerciseShortText {
  const original = createTrainingExerciseOriginalText(input);
  if (
    original.content.length <= TRAINING_SHORT_TEXT_LIMITS.content
    && original.materials.length <= TRAINING_SHORT_TEXT_LIMITS.materials
    && original.coaching.length <= TRAINING_SHORT_TEXT_LIMITS.coaching
  ) {
    return original;
  }
  return createCompactTrainingExerciseShortText(input);
}

export function createTrainingExerciseOriginalText(
  input: TrainingExerciseShortTextInput,
): TrainingExerciseShortText {
  const organization = clean(input.organization).replace(/^aufbau\s*:\s*/i, '');
  const description = clean(input.description).replace(/^ablauf\s*:\s*/i, '');
  const variations = splitVariations(input.variations);
  return {
    content: [
      organization ? `Aufbau: ${organization}` : '',
      description ? `Ablauf: ${description}` : '',
      ...variations.map((variation, index) => `Variation ${index + 1}: ${variation}`),
    ].filter(Boolean).join('\n'),
    materials: clean(input.materials),
    coaching: clean(input.coachingPoints),
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
