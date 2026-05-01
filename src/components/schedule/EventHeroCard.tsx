import React from 'react';

type Props = {
  /** z. B. „Nächstes Spiel“, „Nächstes Training“ */
  label: string;
  children: React.ReactNode;
  /** Optional: Schnellaktionen unter der Karte */
  footer?: React.ReactNode;
};

export function EventHeroCard({ label, children, footer }: Props) {
  return (
    <section className="mb-6 w-full" aria-labelledby="schedule-hero-heading">
      <h2
        id="schedule-hero-heading"
        className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-red-300/90"
      >
        {label}
      </h2>
      <div className="relative">{children}</div>
      {footer ? <div className="relative z-[1]">{footer}</div> : null}
    </section>
  );
}
