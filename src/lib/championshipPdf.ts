import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import brandLogoHeader from '../assets/branding/spielzeitapp-header.png';
import type { ChampionshipFixture } from './championshipFixtures';
import { getOurTeamLogoUrl, PLACEHOLDER_LOGO } from './teamLogos';
import { isViennaPlaceholderKickoff, utcIsoToViennaTimeHHmm } from './viennaTime';

export type ChampionshipPdfMode = 'published' | 'all';

const IMAGE_FETCH_TIMEOUT_MS = 4000;

function formatDateDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Vienna',
  }).format(d);
}

function formatStandDate(): string {
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Vienna',
  }).format(new Date());
}

function kickoffLabel(f: ChampionshipFixture): string {
  if (!f.starts_at || isViennaPlaceholderKickoff(f.starts_at)) return 'offen';
  return utcIsoToViennaTimeHHmm(f.starts_at) || 'offen';
}

function meetupLabel(f: ChampionshipFixture): string {
  if (!f.meeting_at) return '–';
  return utcIsoToViennaTimeHHmm(f.meeting_at) || '–';
}

/** Spielort nur Text; ggf. Name + Adresse zweizeilig. */
function venueLabel(f: ChampionshipFixture): string {
  const loc = f.location?.trim();
  if (!loc) return 'Noch offen';
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return loc;
  return `${parts[0]}\n${parts.slice(1).join(', ')}`;
}

function seasonSubtitle(ageGroup?: string | null, seasonName?: string | null): string {
  const age = String(ageGroup ?? '').trim();
  const seasonRaw = String(seasonName ?? '').trim();
  const season =
    seasonRaw && !/^saison\b/i.test(seasonRaw) ? `Saison ${seasonRaw}` : seasonRaw;
  return [age, season].filter(Boolean).join(' · ');
}

/** Heim links, Gast rechts (Textform, z. B. Feed). */
export function formatChampionshipEncounter(
  f: ChampionshipFixture,
  ourTeamName: string,
): string {
  const us = (ourTeamName || 'Heim').trim() || 'Heim';
  const them = (f.opponent || 'Gegner').trim() || 'Gegner';
  if (f.is_home) return `${us} – ${them}`;
  return `${them} – ${us}`;
}

function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function buildChampionshipPdfFilename(opts: {
  teamName: string;
  ageGroup?: string | null;
  seasonName?: string | null;
  mode: ChampionshipPdfMode;
}): string {
  const parts = [
    'meisterschaftsspielplan',
    slugify(opts.teamName),
    opts.ageGroup ? slugify(opts.ageGroup) : '',
    opts.seasonName ? slugify(opts.seasonName) : '',
  ].filter(Boolean);
  const base = parts.join('-');
  return opts.mode === 'published' ? `${base}.pdf` : `${base}-arbeitsstand.pdf`;
}

function absoluteAssetUrl(pathOrUrl: string): string {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }
  return raw;
}

/** Data-URL laden; Fehler/Timeout → null (PDF läuft weiter). */
async function loadImageDataUrl(pathOrUrl: string): Promise<string | null> {
  const url = absoluteAssetUrl(pathOrUrl);
  if (!url) return null;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    ctrl && typeof window !== 'undefined'
      ? window.setTimeout(() => ctrl.abort(), IMAGE_FETCH_TIMEOUT_MS)
      : null;
  try {
    const res = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      signal: ctrl?.signal,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    if (dataUrl.startsWith('data:image/webp')) {
      return (await webpDataUrlToPng(dataUrl)) || null;
    }
    return dataUrl;
  } catch {
    return null;
  } finally {
    if (timer != null) window.clearTimeout(timer);
  }
}

async function webpDataUrlToPng(dataUrl: string): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  try {
    const img = new Image();
    img.decoding = 'async';
    const loaded = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = dataUrl;
    });
    if (!loaded) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width || 1;
    canvas.height = img.naturalHeight || img.height || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/jpeg')) return 'JPEG';
  return 'PNG';
}

function safeAddImage(
  doc: jsPDF,
  dataUrl: string | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!dataUrl) return;
  try {
    doc.addImage(dataUrl, imageFormatFromDataUrl(dataUrl), x, y, w, h);
  } catch {
    /* broken/unsupported image — PDF weiter */
  }
}

/**
 * Robuster Download / iOS-Fallback:
 * Desktop: Anchor + download
 * iOS/Safari ohne Download-Attr-Support: Blob-URL in neuem Tab
 */
export function triggerPdfBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);

    const supportsDownload = typeof a.download === 'string';
    if (supportsDownload) {
      a.click();
    } else {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.assign(url);
      }
    }
    a.remove();
  } finally {
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }, 60_000);
  }
}

function truncateName(doc: jsPDF, name: string, maxWidth: number): string {
  const raw = name.trim() || '—';
  if (doc.getTextWidth(raw) <= maxWidth) return raw;
  let s = raw;
  while (s.length > 3 && doc.getTextWidth(`${s}…`) > maxWidth) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

/**
 * ÖFB-Layout in der Begegnungszelle:
 * Heimname (rechts) | Heimlogo | – | Gastlogo | Gastname (links)
 */
function drawOefbEncounterCell(opts: {
  doc: jsPDF;
  cellX: number;
  cellY: number;
  cellW: number;
  cellH: number;
  homeName: string;
  awayName: string;
  homeLogo: string | null | undefined;
  awayLogo: string | null | undefined;
}): void {
  const { doc, cellX, cellY, cellW, cellH, homeName, awayName, homeLogo, awayLogo } = opts;
  const logoMm = 8;
  const gap = 1.6;
  const dash = '–';
  const padX = 2;
  const cy = cellY + (cellH - logoMm) / 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(25, 25, 25);

  const centerX = cellX + cellW / 2;
  const dashW = doc.getTextWidth(dash);
  const homeLogoX = centerX - gap - logoMm - dashW / 2;
  const awayLogoX = centerX + dashW / 2 + gap;
  const dashX = centerX;

  const nameMax = Math.max(18, homeLogoX - (cellX + padX) - gap);
  const homeLabel = truncateName(doc, homeName, nameMax);
  const awayLabel = truncateName(doc, awayName, nameMax);

  const textY = cellY + cellH / 2 + 2.2;
  doc.text(homeLabel, homeLogoX - gap, textY, { align: 'right' });
  safeAddImage(doc, homeLogo, homeLogoX, cy, logoMm, logoMm);
  doc.text(dash, dashX, textY, { align: 'center' });
  safeAddImage(doc, awayLogo, awayLogoX, cy, logoMm, logoMm);
  doc.text(awayLabel, awayLogoX + logoMm + gap, textY, { align: 'left' });
}

/**
 * A4 Querformat.
 * Spalten: Datum | Treffpunkt | Anpfiff | Begegnung | Spielort
 * Begegnung ÖFB: Heimname Heimlogo – Gastlogo Gastname
 */
export async function downloadChampionshipSchedulePdf(opts: {
  fixtures: ChampionshipFixture[];
  mode: ChampionshipPdfMode;
  teamName: string;
  ageGroup?: string | null;
  seasonName?: string | null;
  teamLogoUrl?: string | null;
  brandLogoUrl?: string | null;
  /** Gegnername → Logo-URL (Catalog/Event/public) */
  opponentLogoUrls?: Record<string, string>;
}): Promise<{ error: string | null; filename: string }> {
  const filename = buildChampionshipPdfFilename({
    teamName: opts.teamName || 'mannschaft',
    ageGroup: opts.ageGroup,
    seasonName: opts.seasonName,
    mode: opts.mode,
  });

  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { error: 'PDF-Export ist nur im Browser möglich.', filename };
    }
    if (!Array.isArray(opts.fixtures)) {
      return { error: 'Spielplan-Daten fehlen.', filename };
    }

    const rows =
      opts.mode === 'published'
        ? opts.fixtures.filter((f) => f.fixture_status === 'published')
        : [...opts.fixtures];

    rows.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    const ourTeamName = (opts.teamName || 'Mannschaft').trim() || 'Mannschaft';
    // Immer gemeinsamer Own-Team-Resolver (NSG Gölsental) — nicht opponent_catalog
    const ourLogoUrl = opts.teamLogoUrl?.trim() || getOurTeamLogoUrl();
    const ourLogoData =
      (await loadImageDataUrl(ourLogoUrl)) ||
      (await loadImageDataUrl(getOurTeamLogoUrl())) ||
      (await loadImageDataUrl(PLACEHOLDER_LOGO));
    const brandLogoData = await loadImageDataUrl(opts.brandLogoUrl || brandLogoHeader);
    const placeholderData = await loadImageDataUrl(PLACEHOLDER_LOGO);

    const oppLogoCache = new Map<string, string | null>();
    for (const f of rows) {
      const name = (f.opponent || '').trim();
      if (!name || oppLogoCache.has(name)) continue;
      const url = opts.opponentLogoUrls?.[name] || PLACEHOLDER_LOGO;
      try {
        oppLogoCache.set(name, (await loadImageDataUrl(url)) || placeholderData);
      } catch {
        oppLogoCache.set(name, placeholderData);
      }
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    let y = 8;

    const headerLogo = 16;
    safeAddImage(doc, ourLogoData, margin, y, headerLogo, headerLogo);

    const textX = margin + headerLogo + 4;
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('MEISTERSCHAFTSSPIELPLAN', textX, y + 5);

    const sub = seasonSubtitle(opts.ageGroup, opts.seasonName);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (sub) {
      doc.text(sub, textX, y + 10.5);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(ourTeamName, textX, y + (sub ? 15.5 : 11));

    const brandH = 10;
    const brandW = 42;
    safeAddImage(doc, brandLogoData, pageW - margin - brandW, y + 2, brandW, brandH);

    y += headerLogo + 6;

    const usable = pageW - margin * 2;
    const colDatum = Math.round(usable * 0.13);
    const colMeetup = Math.round(usable * 0.11);
    const colKick = Math.round(usable * 0.1);
    const colVenue = Math.round(usable * 0.26);
    const colEncounter = usable - colDatum - colMeetup - colKick - colVenue;

    const head = [['Datum', 'Treffpunkt', 'Anpfiff', 'Begegnung', 'Spielort']];
    // Begegnungstext leer — ÖFB-Layout wird in didDrawCell gezeichnet (keine Rand-Logos)
    const body = rows.map((f) => [
      formatDateDe(f.starts_at),
      meetupLabel(f),
      kickoffLabel(f),
      '',
      venueLabel(f),
    ]);

    const encounterColIndex = 3;

    const drawFooter = (pageNumber: number, pageCount: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 110);
      const footerY = pageH - 6;
      doc.text(`Stand: ${formatStandDate()}`, margin, footerY);
      doc.text('Erstellt mit SpielzeitApp', pageW / 2, footerY, { align: 'center' });
      doc.text(`${pageNumber} / ${pageCount}`, pageW - margin, footerY, { align: 'right' });
    };

    if (body.length === 0) {
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(11);
      doc.text('Keine Spiele für diesen Export.', margin, y + 10);
      drawFooter(1, 1);
    } else {
      autoTable(doc, {
        startY: y,
        head,
        body,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 2.2,
          textColor: [25, 25, 25],
          lineColor: [170, 170, 170],
          lineWidth: 0.15,
          overflow: 'linebreak',
          valign: 'middle',
          minCellHeight: 12,
        },
        headStyles: {
          fillColor: [236, 236, 236],
          textColor: [20, 20, 20],
          fontStyle: 'bold',
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: colDatum, halign: 'center' },
          1: { cellWidth: colMeetup, halign: 'center' },
          2: { cellWidth: colKick, halign: 'center' },
          3: { cellWidth: colEncounter, cellPadding: 1.5 },
          4: { cellWidth: colVenue, fontSize: 7.5 },
        },
        margin: { left: margin, right: margin, bottom: 12 },
        didDrawCell: (data) => {
          // Nur Begegnungs-Spalte — keine Logos in Datum/Treffpunkt/Anpfiff/Spielort
          if (data.section !== 'body' || data.column.index !== encounterColIndex) return;
          const f = rows[data.row.index];
          if (!f) return;
          const oppName = (f.opponent || 'Gegner').trim() || 'Gegner';
          const oppLogo = oppLogoCache.get(oppName) || placeholderData;
          const isHome = f.is_home === true;
          const homeName = isHome ? ourTeamName : oppName;
          const awayName = isHome ? oppName : ourTeamName;
          const homeLogo = isHome ? ourLogoData : oppLogo;
          const awayLogo = isHome ? oppLogo : ourLogoData;
          drawOefbEncounterCell({
            doc,
            cellX: data.cell.x,
            cellY: data.cell.y,
            cellW: data.cell.width,
            cellH: data.cell.height,
            homeName,
            awayName,
            homeLogo,
            awayLogo,
          });
        },
        didDrawPage: (data) => {
          drawFooter(data.pageNumber, doc.getNumberOfPages());
        },
      });
    }

    const blob = doc.output('blob');
    triggerPdfBlobDownload(blob, filename);
    return { error: null, filename };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[championshipPdf] generate failed', err);
    return { error: message || 'PDF konnte nicht erstellt werden.', filename };
  }
}
