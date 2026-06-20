import React from 'react';
import { safeText } from '../../lib/safeText';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';

type InfoRow = { label: string; value: string };

type Props = {
  rows: InfoRow[];
  notes?: string | null;
  children?: React.ReactNode;
};

export function TournamentInfoCard({ rows, notes, children }: Props) {
  const visibleRows = rows.filter((r) => safeText(r.value).length > 0);
  const notesText = safeText(notes);
  if (visibleRows.length === 0 && !notesText && !children) return null;

  return (
    <section className={TC_CARD}>
      <div className={`${TC_CARD_INNER} flex flex-col gap-2`}>
        <p className={TC_SECTION_LABEL}>Turnierinfos</p>
        {visibleRows.length > 0 ? (
          <dl className="grid grid-cols-[minmax(4.5rem,auto)_1fr] gap-x-3 gap-y-1">
            {visibleRows.map((row) => (
              <React.Fragment key={row.label}>
                <dt className="text-[11px] text-white/42">{row.label}</dt>
                <dd className="text-[12px] font-medium leading-snug text-white/86 break-words">{row.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        ) : null}
        {notesText ? (
          <p className="text-[12px] leading-snug text-white/72">
            <span className="text-white/45">Notizen: </span>
            {notesText}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}
