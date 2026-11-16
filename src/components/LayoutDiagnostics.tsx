import React, { useState } from 'react';

function readLayout(): string {
  const vv = window.visualViewport;
  const root = document.getElementById('root');
  const nav = document.querySelector<HTMLElement>('.public-market-nav, [data-app-bottom-nav]');
  const card = nav?.classList.contains('public-market-nav') ? nav : nav?.firstElementChild;
  const shell = document.querySelector<HTMLElement>('.public-exchange');
  const shellStyle = shell ? getComputedStyle(shell) : null;
  const host = document.querySelector<HTMLElement>('.public-market-nav-viewport');
  const hostStyle = host ? getComputedStyle(host) : null;
  const bodyStyle = getComputedStyle(document.body);
  const nativeProbe = document.createElement('div');
  nativeProbe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
  document.body.appendChild(nativeProbe);
  const nativeRect = nativeProbe.getBoundingClientRect();
  nativeProbe.remove();
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
    'Anzeigeprüfung Markt N8 · ' + build,
    `Fenster: ${innerWidth} × ${innerHeight}`,
    `Sichtbar: ${vv ? Math.round(vv.width) + ' × ' + Math.round(vv.height) + ', oben ' + Math.round(vv.offsetTop) + ', Zoom ' + vv.scale : '—'}`,
    `Bildschirm: ${screen.width} × ${screen.height}`,
    `Homescreen: ${matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true ? 'ja' : 'nein'}`,
    'iOS-Sicherheitsabstand: ' + safeBottom,
    'App-Rahmen: ' + rect(root),
    'Markt-Rahmen: ' + rect(shell),
    'Rahmen CSS: ' + (shellStyle ? `Höhe ${shellStyle.height}, max ${shellStyle.maxHeight}, unten ${shellStyle.bottom}, Padding ${shellStyle.paddingBottom}` : '—'),
    'Markt aktiv: ' + document.documentElement.hasAttribute('data-market-shell'),
    'Aktives Feld: ' + (document.activeElement?.tagName ?? '—'),
    'Fester Fensterrahmen: ' + Math.round(nativeRect.top) + ' bis ' + Math.round(nativeRect.bottom),
    'Navi-Verankerung: ' + rect(host),
    'Navi CSS: ' + (hostStyle ? 'Position '+hostStyle.position+', unten '+hostStyle.bottom+', Höhe '+hostStyle.height+', Padding '+hostStyle.paddingBottom+', Transform '+hostStyle.transform : '—'),
    'Dokument CSS: Position '+bodyStyle.position+', Höhe '+bodyStyle.height+', Padding '+bodyStyle.paddingBottom+', Transform '+bodyStyle.transform,
    'Navigation: ' + rect(nav),
    'Sichtbare Leiste: ' + rect(card),
    'Abstand unter Leiste: ' + (nav && card ? Math.round(nav.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom) + ' px' : '—'),
    'Höhenquelle: ' + (document.documentElement.dataset.viewportSource ?? 'viewport'),
    'Homescreen-App-Höhe: ' + document.documentElement.style.getPropertyValue('--app-standalone-height'),
    'Gemessene App-Höhe: ' + document.documentElement.style.getPropertyValue('--app-visible-height'),
  ].join('\n');
}

/** User-initiated, local-only measurement for device-specific display issues. */
export function LayoutDiagnostics({initiallyOpen=false}: {initiallyOpen?:boolean} = {}): React.ReactElement {
  const [values, setValues] = useState(() => initiallyOpen ? readLayout() : '');
  const [copied, setCopied] = useState(false);
  return <details open={initiallyOpen || undefined} style={{background:"#fff",color:"#211d25",border:"1px solid #8886",padding:12,borderRadius:12,marginBottom:20}} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/80" onToggle={event => { if (event.currentTarget.open) { setValues(readLayout()); setCopied(false); } }}>
    <summary className="min-h-8 cursor-pointer font-semibold">Anzeige prüfen</summary>
    <p className="mt-2 text-xs opacity-70">Bei einem Darstellungsfehler diese Werte kopieren oder als Screenshot weitergeben.</p>
    <pre className="my-3 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed">{values}</pre>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3" onClick={() => { setValues(readLayout()); setCopied(false); }}>Neu messen</button>
      <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3" onClick={async () => { try { await navigator.clipboard.writeText(values); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Kopiert' : 'Werte kopieren'}</button>
    </div>
  </details>;
}
