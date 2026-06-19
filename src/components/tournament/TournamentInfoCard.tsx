import React from 'react';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';

type InfoRow = { label: string; value: string };

type Props = {
  rows: InfoRow[];
  notes?: string | null;
  children?: React.ReactNode;
};

export function TournamentInfoCard({ rows, notes, children }: Props) {
  const visibleRows = rows.filter((r) => r.value.trim().length > 0);
  if (visibleRows.length === 0 && !notes?.trim() && !children) return null;

  return (
    <section className={TC_CARD}>
      <div className={`${TC_CARD_INNER} flex flex-col gap-2.5`}>
        <p className={TC_SECTION_LABEL}>Turnierinfos</p>
        {visibleRows.length > 0 ? (
          <dl className="flex flex-col gap-1.5">
            {visibleRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="shrink-0 text-[12px] text-white/45">{row.label}</dt>
                <dd className="text-[13px] font-medium leading-snug text-white/88 break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {notes?.trim() ? (
          <p className="text-[13px] leading-snug text-white/72">
            <span className="text-white/45">Notizen: </span>
            {notes.trim()}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}
