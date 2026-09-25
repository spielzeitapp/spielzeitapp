type MatchTypeHeadingProps = { label: string };

/** Gleiche Spielart-Zeile wie in „Alle Termine“, auch über fertigen Ergebnissen. */
export function MatchTypeHeading({ label }: MatchTypeHeadingProps) {
  const isLeague = /^Meisterschaft(?:sspiel)?$/i.test(label.trim());
  return <span className="inline-flex min-w-0 items-center justify-center gap-1.5 text-center text-[14px] font-bold leading-tight text-white/90 min-[390px]:text-[16px]">
    {isLeague && <span className="shrink-0 text-[18px] leading-none" aria-hidden="true">🏆</span>}
    <span>{isLeague ? 'Meisterschaft' : label}</span>
  </span>;
}
