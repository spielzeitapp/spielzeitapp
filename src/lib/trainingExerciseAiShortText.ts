import { supabase } from './supabaseClient';
import {
  TRAINING_SHORT_TEXT_LIMITS,
  type TrainingExerciseShortText,
  type TrainingExerciseShortTextInput,
} from './trainingExerciseShortText';

type AiShortTextResponse = Partial<TrainingExerciseShortText> & {
  error?: string;
};

function isValidShortText(value: AiShortTextResponse): value is TrainingExerciseShortText {
  return (
    typeof value.content === 'string' &&
    value.content.length <= TRAINING_SHORT_TEXT_LIMITS.content &&
    typeof value.materials === 'string' &&
    value.materials.length <= TRAINING_SHORT_TEXT_LIMITS.materials &&
    typeof value.coaching === 'string' &&
    value.coaching.length <= TRAINING_SHORT_TEXT_LIMITS.coaching
  );
}

/**
 * Fordert eine inhaltlich verständliche Kurzfassung über die geschützte
 * Supabase Edge Function an. Der Browser erhält niemals den OpenAI-Schlüssel.
 */
export async function createTrainingExerciseAiShortText(
  clubId: string,
  input: TrainingExerciseShortTextInput,
): Promise<{ data: TrainingExerciseShortText | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<AiShortTextResponse>(
    'shorten-training-exercise',
    { body: { clubId, input } },
  );

  if (error) {
    return {
      data: null,
      error: 'Die KI-Kurzfassung ist momentan nicht verfügbar. Bitte später erneut versuchen.',
    };
  }
  if (data?.error) return { data: null, error: data.error };
  if (!data || !isValidShortText(data)) {
    return { data: null, error: 'Die KI-Antwort hatte ein ungültiges Format.' };
  }

  return {
    data: {
      content: data.content.trim(),
      materials: data.materials.trim(),
      coaching: data.coaching.trim(),
    },
    error: null,
  };
}
