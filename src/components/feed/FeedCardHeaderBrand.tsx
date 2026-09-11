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
      <span className="sz-club-feed-accent-text">App</span>
      <span className="font-normal text-white/50"> · </span>
      <span className="sz-club-feed-accent-text">{teamLabel}</span>
      {season ? (
        <>
          <span className="font-normal text-white/50"> · </span>
          <span className="font-normal text-white/55">{season}</span>
        </>
      ) : null}
    </p>
  );
}
