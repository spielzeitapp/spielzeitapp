import React from 'react';

/** Einheitliche Kopfzeile in Feed-Karten (Welcome-Look: Spielzeit + App). */
export function FeedCardHeaderBrand({
  teamLabel,
  seasonLabel,
}: {
  teamLabel: string;
  /** Optional: „U11 · 2025/26“ – behält ursprüngliche Post-Saison. */
  seasonLabel?: string | null;
}) {
  const season = (seasonLabel ?? '').trim();
  return (
    <p className="truncate text-[13px] font-semibold leading-snug sm:text-sm">
      <span className="text-white">Spielzeit</span>
      <span className="text-[#f87171]">App</span>
      <span className="font-normal text-white/50"> · </span>
      <span className="text-red-200/95">{teamLabel}</span>
      {season ? (
        <>
          <span className="font-normal text-white/50"> · </span>
          <span className="font-normal text-white/55">{season}</span>
        </>
      ) : null}
    </p>
  );
}
