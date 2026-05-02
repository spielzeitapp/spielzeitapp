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
    <section
      className="mb-6 w-full pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      aria-labelledby="schedule-hero-heading"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <h2
          id="schedule-hero-heading"
          className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-red-300/90"
        >
          {label}
        </h2>
        {labelAside ? <div className="shrink-0">{labelAside}</div> : null}
      </div>

      <div className="relative w-full overflow-hidden rounded-[28px] border border-red-500/35 bg-black/72 p-5 shadow-[0_0_52px_rgba(220,38,38,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,.18),transparent_50%),radial-gradient(circle_at_top_right,rgba(239,68,68,.2),transparent_42%),linear-gradient(to_bottom,rgba(0,0,0,.52),rgba(55,0,0,.62))]"
          aria-hidden
        />
        <div className="relative z-10 min-h-[300px] w-full min-w-0">{children}</div>
      </div>

      {footer ? <div className="relative z-[1] mt-3">{footer}</div> : null}
    </section>
  );
}
