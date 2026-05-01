import React from 'react';

type Props = {
  /** z. B. „Nächstes Spiel“, „Nächstes Training“ */
  label: string;
  children: React.ReactNode;
  /** Optional: Schnellaktionen unter der Karte */
  footer?: React.ReactNode;
  /** z. B. Status-Pill (Eltern/Spieler) oder TrainerStatsMini */
  labelAside?: React.ReactNode;
};

export function EventHeroCard({ label, children, footer, labelAside }: Props) {
  return (
    <section className="mb-6 w-full" aria-labelledby="schedule-hero-heading">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <h2
          id="schedule-hero-heading"
          className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-red-300/90"
        >
          {label}
        </h2>
        {labelAside ? <div className="shrink-0">{labelAside}</div> : null}
      </div>
      <div className="relative">{children}</div>
      {footer ? <div className="relative z-[1]">{footer}</div> : null}
    </section>
  );
}
