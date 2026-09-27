import React, { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { isStandaloneDisplayMode } from '../lib/pwaDisplayMode';

const DISMISSED_KEY = 'spielzeitapp-home-guide-dismissed-until';
const DISMISS_DAYS = 30;

export function HomeScreenGuide({ compact = false }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!mobile || isStandaloneDisplayMode()) return;
    try {
      if (Number(localStorage.getItem(DISMISSED_KEY)) > Date.now()) return;
    } catch { /* Storage can be unavailable in private browsing. */ }
    const timer = window.setTimeout(() => setVisible(true), compact ? 0 : 5000);
    return () => window.clearTimeout(timer);
  }, [compact]);

  if (!visible) return null;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const safari = ios && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_DAYS * 86400000)); } catch { /* optional */ }
  };

  const steps = ios
    ? safari
      ? ['In Safari auf Teilen tippen (Quadrat mit Pfeil).', 'Zum Home-Bildschirm auswählen.', 'Falls angezeigt, Als Web-App öffnen aktivieren und Hinzufügen tippen.']
      : ['spielzeitapp.at in Safari öffnen.', 'Auf Teilen tippen und Zum Home-Bildschirm auswählen.', 'Hinzufügen tippen.']
    : ['Im Browser das Menü ⋮ öffnen.', 'App installieren oder Zum Startbildschirm hinzufügen auswählen.', 'Bestätigen und die App über das neue Symbol öffnen.'];

  return (
    <section aria-label="SpielzeitApp zum Home-Bildschirm hinzufügen" className={compact
      ? 'mt-2 rounded-2xl border border-white/20 bg-zinc-950/95 p-3 text-left text-white shadow-xl'
      : 'fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[75] mx-auto max-w-md rounded-2xl border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl'}>
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">SpielzeitApp auf den Home-Bildschirm</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-300">Termine und Nachrichten direkt über das App-Symbol öffnen.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Hinweis schließen" className="rounded-md p-1 text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><X className="h-4 w-4" /></button>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-white/15 pt-1 text-xs leading-relaxed text-zinc-200">
          <ol>{steps.map((step, index) => (
            <li key={step} className="flex items-center gap-3 border-b border-white/10 py-2.5 last:border-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 font-bold text-white">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}</ol>
        </div>
      )}
      <button type="button" onClick={() => setExpanded(!expanded)} className="mt-3 min-h-11 w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        {expanded ? 'Anleitung schließen' : 'Anleitung anzeigen'}
      </button>
    </section>
  );
}
