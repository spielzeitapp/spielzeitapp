import React from 'react';

type Props = {
  label: string;
  value: string | null | undefined;
};

export function TrainingExerciseDetailBlock({ label, value }: Props): React.ReactElement | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</h3>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{text}</p>
    </section>
  );
}
