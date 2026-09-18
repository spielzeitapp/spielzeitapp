import React, { useEffect, useState } from 'react';
import {
  DEPLOYMENT_UPDATE_EVENT,
  getPendingDeploymentEntry,
  refreshToDeployment,
} from '../lib/deploymentRefresh';

type DeploymentUpdateDetail = { entry?: string };

export const DeploymentUpdatePrompt: React.FC = () => {
  const [entry, setEntry] = useState<string | null>(() => getPendingDeploymentEntry());

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DeploymentUpdateDetail>).detail;
      if (detail?.entry) setEntry(detail.entry);
    };
    window.addEventListener(DEPLOYMENT_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(DEPLOYMENT_UPDATE_EVENT, onUpdate);
  }, []);

  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 backdrop-blur-sm sm:items-center sm:pb-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deployment-update-title"
      aria-describedby="deployment-update-description"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-[26px] border border-red-400/30 bg-[linear-gradient(145deg,rgba(38,11,16,0.98),rgba(10,10,12,0.99)_68%)] p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.75),0_0_36px_rgba(220,38,38,0.16)]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-400/75 to-transparent" />
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-300/25 bg-red-500/15 text-lg font-black text-red-300">
            S
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">SpielzeitApp</p>
            <h2 id="deployment-update-title" className="mt-0.5 text-xl font-bold tracking-tight">
              Neue Version verfügbar
            </h2>
          </div>
        </div>

        <p id="deployment-update-description" className="mt-4 text-sm leading-relaxed text-white/70">
          Es gibt Verbesserungen und Fehlerbehebungen. Aktualisiere jetzt, damit du mit der neuesten Version weiterarbeitest.
        </p>

        <button
          type="button"
          onClick={() => refreshToDeployment(entry)}
          className="sz-club-primary mt-5 min-h-12 w-full rounded-2xl px-4 py-3 text-base font-bold text-white shadow-[0_10px_28px_rgba(122,29,42,0.28)] active:scale-[0.99]"
        >
          Jetzt aktualisieren
        </button>
      </div>
    </div>
  );
};
