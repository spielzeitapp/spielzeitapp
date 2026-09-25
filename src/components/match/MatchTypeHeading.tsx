type MatchTypeHeadingProps = { label: string; ageGroup?: string | null };

/** Gleiche Spielart-Zeile wie in „Alle Termine“, auch über fertigen Ergebnissen. */
export function MatchTypeHeading({ label, ageGroup }: MatchTypeHeadingProps) {
  const isLeague = /^Meisterschaft(?:sspiel)?$/i.test(label.trim());
  const age = /^U\d{1,2}$/i.test(ageGroup?.trim() ?? '') ? ageGroup!.trim().toUpperCase() : null;
  return <span className="inline-flex min-w-0 flex-col items-center justify-center gap-1 text-center leading-tight">
    {age && <span className="text-[12px] font-bold tracking-[0.18em] text-rose-300">{age}</span>}
    <span className="inline-flex items-center justify-center gap-1.5 text-[16px] font-extrabold tracking-[0.045em] text-white min-[390px]:text-[18px]">
      {isLeague && <span className="shrink-0 text-[19px] leading-none" aria-hidden="true">🏆</span>}
      <span>{(isLeague ? 'Meisterschaft' : label).toLocaleUpperCase('de-AT')}</span>
    </span>
  </span>;
}
