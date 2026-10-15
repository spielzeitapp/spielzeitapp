import React, { useState } from 'react';

function readLayout(): string {
  const vv = window.visualViewport;
  const root = document.getElementById('root');
  const nav = document.querySelector<HTMLElement>('[data-app-bottom-nav]');
  const card = nav?.firstElementChild;
  const rect = (el: Element | null | undefined) => {
    if (!el) return '—';
    const r = el.getBoundingClientRect();
    return `oben ${Math.round(r.top)}, unten ${Math.round(r.bottom)}, Höhe ${Math.round(r.height)}`;
  };
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(probe);
  const safeBottom = getComputedStyle(probe).paddingBottom;
  probe.remove();
  const build = Array.from(document.scripts).find(s => s.type === 'module' && s.src.includes('/assets/main-'))?.src.split('/').pop() ?? 'lokal';
  return [
    'Anzeigeprüfung N4 · ' + build,
    `Fenster: ${innerWidth} × ${innerHeight}`,
    `Sichtbar: ${vv ? Math.round(vv.width) + ' × ' + Math.round(vv.height) + ', oben ' + Math.round(vv.offsetTop) + ', Zoom ' + vv.scale : '—'}`,
    `Bildschirm: ${screen.width} × ${screen.height}`,
    `Homescreen: ${matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true ? 'ja' : 'nein'}`,
    'iOS-Sicherheitsabstand: ' + safeBottom,
    'App-Rahmen: ' + rect(root),
    'Navigation: ' + rect(nav),
    'Sichtbare Leiste: ' + rect(card),
    'Abstand unter Leiste: ' + (nav && card ? Math.round(nav.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom) + ' px' : '—'),
    'Gemessene App-Höhe: ' + document.documentElement.style.getPropertyValue('--app-visible-height'),
  ].join('\n');
}

/** User-initiated, local-only measurement for device-specific display issues. */
export function LayoutDiagnostics(): React.ReactElement {
  const [values, setValues] = useState('');
  const [copied, setCopied] = useState(false);
  return <details className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/80" onToggle={event => { if (event.currentTarget.open) { setValues(readLayout()); setCopied(false); } }}>
    <summary className="min-h-8 cursor-pointer font-semibold">Anzeige prüfen</summary>
    <p className="mt-2 text-xs text-white/60">Bei einem Darstellungsfehler diese Werte kopieren oder als Screenshot weitergeben.</p>
    <pre className="my-3 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed">{values}</pre>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3" onClick={() => { setValues(readLayout()); setCopied(false); }}>Neu messen</button>
      <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3" onClick={async () => { try { await navigator.clipboard.writeText(values); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Kopiert' : 'Werte kopieren'}</button>
    </div>
  </details>;
}
