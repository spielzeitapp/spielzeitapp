import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import brandLogoHeader from '../assets/branding/spielzeitapp-header.png';
import type { ChampionshipFixture } from './championshipFixtures';
import {
  seasonPhaseFilenameSlug,
  seasonPhaseHeaderSuffix,
  type SeasonPhase,
} from './seasonPhase';
import { getOurTeamLogoUrl, PLACEHOLDER_LOGO } from './teamLogos';
import { isViennaPlaceholderKickoff, utcIsoToViennaTimeHHmm } from './viennaTime';

export type ChampionshipPdfMode = 'published' | 'all';

const IMAGE_FETCH_TIMEOUT_MS = 4000;

/** de-AT Kurzwochentage mit Punkt — berechnet aus Europe/Vienna, nicht hardcodiert pro Spiel. */
const PDF_WEEKDAY_ABBR: Record<string, string> = {
  mo: 'Mo.',
  di: 'Di.',
  mi: 'Mi.',
  do: 'Do.',
  fr: 'Fr.',
  sa: 'Sa.',
  so: 'So.',
};

/**
 * PDF-Datumsspalte: „So. 06.09.2026“ (Europe/Vienna, kein UTC-Tageswechsel).
 */
export function formatPdfDateWithWeekday(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const wdKey = get('weekday').replace(/\.$/, '').trim().toLowerCase();
  const wd = PDF_WEEKDAY_ABBR[wdKey] ?? `${get('weekday').replace(/\.$/, '').trim()}.`;
  const day = get('day');
  const month = get('month');
  const year = get('year');
  if (!day || !month || !year) return '—';
  return `${wd} ${day}.${month}.${year}`;
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

/** Name (Zeile 1) + Adresse (Zeile 2) für hierarchische Spielort-Darstellung. */
export function splitVenueDisplayLines(
  location: string | null | undefined,
): { name: string; address: string | null } {
  const loc = String(location ?? '').trim();
  if (!loc) return { name: 'Noch offen', address: null };
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { name: loc, address: null };
  return { name: parts[0], address: parts.slice(1).join(', ') };
}

/** Spielort: erste Zeile semibold/bold, Adresse normal — max. 2 Zeilen. */
export function drawVenueHierarchyCell(opts: {
  doc: jsPDF;
  cellX: number;
  cellY: number;
  cellW: number;
  cellH: number;
  location: string | null | undefined;
}): void {
  const { doc, cellX, cellY, cellW, cellH, location } = opts;
  const { name, address } = splitVenueDisplayLines(location);
  const padX = 2;
  const maxW = Math.max(8, cellW - padX * 2);
  const lineH = 3.5;

  if (address) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(25, 25, 25);
    let nameLine = name;
    while (nameLine.length > 3 && doc.getTextWidth(nameLine) > maxW) {
      nameLine = `${nameLine.slice(0, -2)}…`;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let addrLine = address;
    while (addrLine.length > 3 && doc.getTextWidth(addrLine) > maxW) {
      addrLine = `${addrLine.slice(0, -2)}…`;
    }
    const blockH = lineH * 2;
    const startY = cellY + (cellH - blockH) / 2 + 2.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(nameLine, cellX + padX, startY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(55, 55, 55);
    doc.text(addrLine, cellX + padX, startY + lineH);
    return;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(25, 25, 25);
  const lines = doc.splitTextToSize(name, maxW) as string[];
  const shown = lines.slice(0, 2);
  if (lines.length > 2 && shown[1]) {
    shown[1] = truncateName(doc, shown[1].replace(/…$/, ''), maxW);
  }
  const blockH = shown.length * lineH;
  const startY = cellY + (cellH - blockH) / 2 + 2.5;
  shown.forEach((line, i) => {
    doc.text(line, cellX + padX, startY + i * lineH);
  });
}

function seasonLine(seasonName?: string | null): string {
  const seasonRaw = String(seasonName ?? '').trim();
  if (!seasonRaw) return '';
  return /^saison\b/i.test(seasonRaw) ? seasonRaw : `Saison ${seasonRaw}`;
}

/** Unterzeile: „Saison 2026/27 · SPG Rohrbach“. */
function championshipHeaderSubtitle(
  seasonName: string | null | undefined,
  teamName: string,
): string {
  const season = seasonLine(seasonName);
  const team = teamName.trim() || 'Mannschaft';
  return [season, team].filter(Boolean).join(' · ');
}

/** Eine Hauptzeile: U12 (rot) + „ – MEISTERSCHAFTSSPIELPLAN[ HERBST 2026]“ (schwarz). */
function drawChampionshipHeaderTitle(
  doc: jsPDF,
  x: number,
  baselineY: number,
  ageGroup?: string | null,
  phaseSuffix = '',
): void {
  const age = String(ageGroup ?? '').trim();
  const titleRest = ` – MEISTERSCHAFTSSPIELPLAN${phaseSuffix}`;
  doc.setFont('helvetica', 'bold');
  if (age) {
    doc.setFontSize(19);
    doc.setTextColor(220, 38, 38);
    doc.text(age, x, baselineY);
    const ageW = doc.getTextWidth(age);
    doc.setFontSize(17);
    doc.setTextColor(20, 20, 20);
    doc.text(titleRest, x + ageW, baselineY);
    return;
  }
  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  doc.text(`MEISTERSCHAFTSSPIELPLAN${phaseSuffix}`, x, baselineY);
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
  seasonPhase?: SeasonPhase | null;
  mode: ChampionshipPdfMode;
}): string {
  const parts = [
    'meisterschaftsspielplan',
    slugify(opts.teamName),
    opts.ageGroup ? slugify(opts.ageGroup) : '',
    opts.seasonName ? slugify(opts.seasonName) : '',
    seasonPhaseFilenameSlug({
      seasonName: opts.seasonName,
      storedPhase: opts.seasonPhase,
    }),
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
export async function loadImageDataUrl(pathOrUrl: string): Promise<string | null> {
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

/** Vereinsname max. 2 Zeilen; letzte Zeile ggf. gekürzt. */
function fitClubNameLines(doc: jsPDF, name: string, maxWidth: number, maxLines = 2): string[] {
  const raw = name.trim() || '—';
  const split = doc.splitTextToSize(raw, maxWidth) as string[];
  if (split.length <= maxLines) return split.length ? split : [raw];
  const kept = split.slice(0, maxLines);
  kept[maxLines - 1] = truncateName(doc, kept[maxLines - 1].replace(/…$/, ''), maxWidth);
  return kept;
}

/**
 * ÖFB-Layout in der Begegnungszelle:
 * Heimname (rechts) | Heimlogo | – | Gastlogo | Gastname (links)
 */
export function drawOefbEncounterCell(opts: {
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
  const logoMm = 9.2;
  /** Abstand Name ↔ Logo */
  const nameGap = 1.8;
  /** Abstand Logo ↔ Gedankenstrich (etwas mehr Luft) */
  const dashGap = 2.6;
  const dash = '–';
  const padX = 2;
  const cy = cellY + (cellH - logoMm) / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(25, 25, 25);

  const centerX = cellX + cellW / 2;
  const dashW = doc.getTextWidth(dash);
  const homeLogoX = centerX - dashGap - logoMm - dashW / 2;
  const awayLogoX = centerX + dashW / 2 + dashGap;
  const dashX = centerX;

  const nameMax = Math.max(18, homeLogoX - (cellX + padX) - nameGap);
  const homeLines = fitClubNameLines(doc, homeName, nameMax, 2);
  const awayLines = fitClubNameLines(doc, awayName, nameMax, 2);
  const lineH = 3.8;
  const homeBlockH = homeLines.length * lineH;
  const awayBlockH = awayLines.length * lineH;
  const homeStartY = cellY + (cellH - homeBlockH) / 2 + 2.7;
  const awayStartY = cellY + (cellH - awayBlockH) / 2 + 2.7;
  const dashY = cellY + cellH / 2 + 2.5;

  homeLines.forEach((line, i) => {
    doc.text(line, homeLogoX - nameGap, homeStartY + i * lineH, { align: 'right' });
  });
  safeAddImage(doc, homeLogo, homeLogoX, cy, logoMm, logoMm);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(25, 25, 25);
  doc.text(dash, dashX, dashY, { align: 'center' });
  safeAddImage(doc, awayLogo, awayLogoX, cy, logoMm, logoMm);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  awayLines.forEach((line, i) => {
    doc.text(line, awayLogoX + logoMm + nameGap, awayStartY + i * lineH, { align: 'left' });
  });
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
  seasonPhase?: SeasonPhase | null;
  teamLogoUrl?: string | null;
  brandLogoUrl?: string | null;
  /** Gegnername → Logo-URL (Catalog/Event/public) */
  opponentLogoUrls?: Record<string, string>;
}): Promise<{ error: string | null; filename: string }> {
  const filename = buildChampionshipPdfFilename({
    teamName: opts.teamName || 'mannschaft',
    ageGroup: opts.ageGroup,
    seasonName: opts.seasonName,
    seasonPhase: opts.seasonPhase,
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
    const subtitle = championshipHeaderSubtitle(opts.seasonName, ourTeamName);
    const phaseSuffix = seasonPhaseHeaderSuffix({
      seasonName: opts.seasonName,
      storedPhase: opts.seasonPhase ?? null,
    });

    drawChampionshipHeaderTitle(doc, textX, y + 7, opts.ageGroup, phaseSuffix);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(45, 45, 45);
    doc.text(subtitle, textX, y + 13.5);

    const brandH = 10;
    const brandW = 42;
    safeAddImage(doc, brandLogoData, pageW - margin - brandW, y + 2, brandW, brandH);

    y += headerLogo + 6;

    const usable = pageW - margin * 2;
    // Datum etwas breiter für „So. 06.09.2026“; Treffpunkt/Anpfiff minimal schmaler
    const colDatum = Math.round(usable * 0.145);
    const colMeetup = Math.round(usable * 0.075);
    const colKick = Math.round(usable * 0.07);
    const colVenue = Math.round(usable * 0.2);
    const colEncounter = usable - colDatum - colMeetup - colKick - colVenue;

    const head = [['Datum', 'Treffpunkt', 'Anpfiff', 'Begegnung', 'Spielort']];
    // Begegnung + Spielort leer — Custom-Draw in didDrawCell
    const body = rows.map((f) => [
      formatPdfDateWithWeekday(f.starts_at),
      meetupLabel(f),
      kickoffLabel(f),
      '',
      '',
    ]);

    const encounterColIndex = 3;
    const venueColIndex = 4;

    const drawFooter = (pageNumber: number, pageCount: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 110);
      const footerY = pageH - 6;
      doc.text(`Stand: ${formatStandDate()} · Änderungen vorbehalten`, margin, footerY);
      doc.text('Erstellt mit SpielzeitApp', pageW / 2, footerY, { align: 'center' });
      doc.text(`Seite ${pageNumber} von ${pageCount}`, pageW - margin, footerY, {
        align: 'right',
      });
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
          fontSize: 10,
          cellPadding: 2.4,
          textColor: [25, 25, 25],
          lineColor: [170, 170, 170],
          lineWidth: 0.15,
          overflow: 'linebreak',
          valign: 'middle',
          minCellHeight: 14.2,
        },
        headStyles: {
          fillColor: [236, 236, 236],
          textColor: [20, 20, 20],
          fontStyle: 'bold',
          fontSize: 9.5,
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: colDatum, halign: 'center', fontSize: 10.5, fontStyle: 'bold' },
          1: { cellWidth: colMeetup, halign: 'center', fontSize: 10, fontStyle: 'normal' },
          2: { cellWidth: colKick, halign: 'center', fontSize: 10, fontStyle: 'normal' },
          3: { cellWidth: colEncounter, cellPadding: 1.8 },
          4: { cellWidth: colVenue, cellPadding: 1.5 },
        },
        margin: { left: margin, right: margin, bottom: 12 },
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          if (data.column.index === 1 || data.column.index === 2) {
            const raw = String(data.cell.raw ?? '')
              .trim()
              .toLowerCase();
            if (raw === 'offen') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 10;
              // dezentes Spielzeit-Rot — S/W weiterhin lesbar
              data.cell.styles.textColor = [180, 45, 45];
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section !== 'body') return;
          if (data.column.index === venueColIndex) {
            const f = rows[data.row.index];
            if (!f) return;
            drawVenueHierarchyCell({
              doc,
              cellX: data.cell.x,
              cellY: data.cell.y,
              cellW: data.cell.width,
              cellH: data.cell.height,
              location: f.location,
            });
            return;
          }
          if (data.column.index !== encounterColIndex) return;
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
