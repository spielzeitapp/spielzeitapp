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
  content: 390,
  materials: 135,
  coaching: 330,
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
  const text = clean(value);
  if (!text) return [];
  return text
    .split(/\n+|\s+[–—]\s+|(?<=[.!?;])\s+(?=[A-ZÄÖÜ0-9])/)
    .flatMap((part) => part.split(/\s*;\s*/))
    .map(withoutBullet)
    .map((part) => part.replace(/[.;,\s]+$/, '').trim())
    .filter((part) => part.length >= 3 && !/^video\s*:/i.test(part));
}

function sentenceWithin(value: string, max: number): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max + 1);
  const boundary = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf(' '));
  return `${slice.slice(0, boundary > max * 0.55 ? boundary : max).trimEnd()}…`;
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

function bullets(items: string[], limit: number, maxItems: number): string {
  const result: string[] = [];
  for (const original of unique(items)) {
    if (result.length >= maxItems) break;
    const remaining = limit - result.join('\n').length - (result.length ? 1 : 0);
    if (remaining < 18) break;
    const item = sentenceWithin(original, Math.min(remaining - 2, 125));
    if (item) result.push(`• ${item}`);
  }
  return result.join('\n');
}

function compactMaterials(value: unknown): string {
  const parts = clean(value)
    .split(/\n|,|;/)
    .map(withoutBullet)
    .map((part) => part.trim())
    .filter(Boolean);
  return sentenceWithin(unique(parts).join(', '), TRAINING_SHORT_TEXT_LIMITS.materials);
}

/**
 * Erstellt einen kompakten, aber weiterhin verständlichen Trainer-Spickzettel.
 * Der ausführliche Ursprungstext wird dabei nicht verändert.
 */
export function createTrainingExerciseShortText(
  input: TrainingExerciseShortTextInput,
): TrainingExerciseShortText {
  const organization = splitThoughts(input.organization).map((item, index) =>
    index === 0 && !/^aufbau\s*:/i.test(item) ? `Aufbau: ${item}` : item,
  );
  const content = bullets(
    [...organization.slice(0, 1), ...splitThoughts(input.description)],
    TRAINING_SHORT_TEXT_LIMITS.content,
    5,
  );
  const coaching = bullets(
    [...splitThoughts(input.coachingPoints), ...splitThoughts(input.variations).map((item) => `Variation: ${item}`)],
    TRAINING_SHORT_TEXT_LIMITS.coaching,
    5,
  );

  return {
    content,
    materials: compactMaterials(input.materials),
    coaching,
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
