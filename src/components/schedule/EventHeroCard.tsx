import React from 'react';
import {
  dsMatchdaySectionLabelClass,
  dsScheduleHeroPanelClass,
  dsScheduleHeroPanelGlowClass,
} from '../../lib/premiumDesignSystem';

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
        <h2 id="schedule-hero-heading" className={dsMatchdaySectionLabelClass()}>
          {label}
        </h2>
        {labelAside ? <div className="shrink-0">{labelAside}</div> : null}
      </div>

      <div className={dsScheduleHeroPanelClass()}>
        <div className={dsScheduleHeroPanelGlowClass()} aria-hidden />
        <div className="relative z-10 min-h-[7.5rem] w-full min-w-0 py-0.5">
          {children}
        </div>
      </div>

      {footer ? <div className="relative z-[1] mt-2">{footer}</div> : null}
    </section>
  );
}
