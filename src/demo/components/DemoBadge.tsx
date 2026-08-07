import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_TOUR_STATIONS } from '../demoTourConfig';
import {
  dismissDemoTour,
  getDemoTourSnapshot,
  resumeOrStartDemoTour,
  startDemoTour,
  subscribeDemoTour,
} from '../demoTourState';
import { useDemoMode } from '../DemoContext';

const RESET_CONFIRM =
  'Demo zurücksetzen? Alle lokalen Änderungen wie Zusagen, Aufstellungen, LIVE-Ereignisse und Ergebnisse werden auf den Ausgangszustand zurückgesetzt.';

/**
 * Klickbares DEMO-Badge mit Hilfe-Menü (Rundgang / Reset).
 */
export function DemoBadge(): React.ReactElement {
  const demo = useDemoMode();
  const navigate = useNavigate();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tourPhase, setTourPhase] = useState(() => getDemoTourSnapshot().phase);

  useEffect(() => subscribeDemoTour(() => setTourPhase(getDemoTourSnapshot().phase)), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const startTour = useCallback(() => {
    startDemoTour();
    navigate(DEMO_TOUR_STATIONS[0].path);
    setOpen(false);
  }, [navigate]);

  const continueTour = useCallback(() => {
    const snap = resumeOrStartDemoTour();
    const station = DEMO_TOUR_STATIONS[snap.stepIndex];
    if (station) navigate(station.path);
    setOpen(false);
  }, [navigate]);

  const endTour = useCallback(() => {
    dismissDemoTour();
    setOpen(false);
  }, []);

  const resetDemo = useCallback(() => {
    if (!demo?.resetAllDemo) return;
    if (!window.confirm(RESET_CONFIRM)) return;
    demo.resetAllDemo();
    dismissDemoTour();
    navigate('/demo/home', { replace: true });
    setOpen(false);
  }, [demo, navigate]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className="rounded border border-white/20 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/70 touch-manipulation hover:bg-white/10 hover:text-white"
        title="Demo-Hilfe: Rundgang und Zurücksetzen"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        Demo
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-[80] w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-white/15 bg-neutral-950/98 p-1.5 shadow-xl backdrop-blur-md"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
            Demo-Hilfe
          </p>
          {tourPhase === 'active' ? (
            <MenuItem label="Rundgang fortsetzen" onClick={continueTour} />
          ) : (
            <MenuItem label="Geführten Rundgang starten" onClick={startTour} />
          )}
          {tourPhase !== 'idle' ? <MenuItem label="Rundgang beenden" onClick={endTour} /> : null}
          <MenuItem label="Rundgang neu starten" onClick={startTour} />
          <div className="my-1 border-t border-white/10" />
          <MenuItem label="Demo zurücksetzen" onClick={resetDemo} danger />
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] leading-snug text-white/35">
            Nur lokal · Reload setzt Daten sowieso auf den Seed zurück.
          </p>
          <p className="px-2.5 pb-1.5 pt-0.5 text-[10px] leading-snug text-white/35">
            Spieler und Fotos sind vollständig fiktive Demo-Daten und KI-generiert.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        'flex w-full touch-manipulation items-center rounded-lg px-2.5 py-2.5 text-left text-[13px] font-medium',
        danger ? 'text-red-300 hover:bg-red-500/10' : 'text-white/90 hover:bg-white/8',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
