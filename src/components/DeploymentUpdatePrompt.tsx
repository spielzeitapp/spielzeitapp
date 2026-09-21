import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  DEPLOYMENT_UPDATE_EVENT,
  getPendingDeploymentEntry,
  refreshToDeployment,
} from '../lib/deploymentRefresh';
import appIcon from '../assets/branding/spielzeitapp-icon.png';

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
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_50%_42%,rgba(120,22,34,0.24),rgba(0,0,0,0.88)_48%,rgba(0,0,0,0.95)_100%)] px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deployment-update-title"
      aria-describedby="deployment-update-description"
    >
      <div className="relative w-full max-w-[22rem] overflow-hidden rounded-[30px] border border-red-400/30 bg-[linear-gradient(150deg,rgba(43,12,18,0.98),rgba(12,10,12,0.99)_64%)] px-5 pb-5 pt-6 text-center text-white shadow-[0_28px_80px_rgba(0,0,0,0.78),0_0_52px_rgba(220,38,38,0.2)]">
        <div className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-red-300/90 to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/20 blur-3xl" />

        <div className="relative mx-auto flex h-[74px] w-[74px] items-center justify-center rounded-[24px] border border-white/10 bg-black/35 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(0,0,0,0.38)]">
          <img src={appIcon} alt="" className="h-full w-full object-contain" aria-hidden />
        </div>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-red-300">
          Update bereit
        </p>
        <h2 id="deployment-update-title" className="mt-1.5 text-[24px] font-black leading-tight tracking-tight">
          Neue Version verfügbar
        </h2>

        <p id="deployment-update-description" className="mx-auto mt-3 max-w-[18rem] text-[14px] leading-relaxed text-white/68">
          Wir haben die SpielzeitApp verbessert. Aktualisiere jetzt – deine Daten und Einstellungen bleiben erhalten.
        </p>

        <button
          type="button"
          onClick={() => refreshToDeployment(entry)}
          className="sz-club-primary mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[16px] font-bold text-white shadow-[0_12px_30px_rgba(122,29,42,0.34)] transition-transform active:scale-[0.985]"
        >
          <RefreshCw className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
          App aktualisieren
        </button>

        <p className="mt-3 text-[11px] font-medium text-white/42">In wenigen Sekunden erledigt.</p>
      </div>
    </div>
  );
};
