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
      className="mb-3 w-full pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
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

      <div className="relative w-full overflow-hidden rounded-3xl border border-red-900/40 bg-black/45 shadow-2xl shadow-black/60">
        <div className="relative z-10 max-h-[46svh] min-h-0 w-full min-w-0 overflow-hidden sm:max-h-[min(48vh,23rem)]">
          {children}
        </div>
      </div>

      {footer ? <div className="relative z-[1] mt-2">{footer}</div> : null}
    </section>
  );
}
