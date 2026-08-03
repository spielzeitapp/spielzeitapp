import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import brandLogoHeader from '../assets/branding/spielzeitapp-header.png';
import type { ChampionshipFixture } from './championshipFixtures';
import { PLACEHOLDER_LOGO } from './teamLogos';
import { isViennaPlaceholderKickoff, utcIsoToViennaTimeHHmm } from './viennaTime';

export type ChampionshipPdfMode = 'published' | 'all';

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

/** Heim links, Gast rechts. */
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

async function loadImageDataUrl(pathOrUrl: string): Promise<string | null> {
  const url = absoluteAssetUrl(pathOrUrl);
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/jpeg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
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
    /* ignore broken image */
  }
}

/**
 * A4 Querformat.
 * Spalten: Datum | Treffpunkt | Anpfiff | Begegnung | Spielort
 * Begegnung: [Heimlogo] Heim – Gast [Gastlogo]
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
  const rows =
    opts.mode === 'published'
      ? opts.fixtures.filter((f) => f.fixture_status === 'published')
      : [...opts.fixtures];

  rows.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const filename = buildChampionshipPdfFilename({
    teamName: opts.teamName,
    ageGroup: opts.ageGroup,
    seasonName: opts.seasonName,
    mode: opts.mode,
  });

  const ourLogoData =
    (await loadImageDataUrl(opts.teamLogoUrl || PLACEHOLDER_LOGO)) ||
    (await loadImageDataUrl(PLACEHOLDER_LOGO));
  const brandLogoData = await loadImageDataUrl(opts.brandLogoUrl || brandLogoHeader);
  const placeholderData = await loadImageDataUrl(PLACEHOLDER_LOGO);

  const oppLogoCache = new Map<string, string | null>();
  for (const f of rows) {
    const name = (f.opponent || '').trim();
    if (!name || oppLogoCache.has(name)) continue;
    const url = opts.opponentLogoUrls?.[name] || PLACEHOLDER_LOGO;
    oppLogoCache.set(name, (await loadImageDataUrl(url)) || placeholderData);
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = 9;

  const headerLogo = 14;
  safeAddImage(doc, ourLogoData, margin, y, headerLogo, headerLogo);

  const titleParts = [
    'Meisterschaftsspielplan',
    (opts.ageGroup || '').trim(),
    (opts.seasonName || '').trim(),
  ].filter(Boolean);
  const title = titleParts.join(' ');

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, margin + headerLogo + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(opts.teamName || 'Mannschaft', margin + headerLogo + 4, y + 11.5);

  // App-Header-Branding (Wortmarke), Querformat rechts oben
  const brandH = 10;
  const brandW = 42;
  safeAddImage(doc, brandLogoData, pageW - margin - brandW, y + 2, brandW, brandH);

  y += headerLogo + 5;

  const head = [['Datum', 'Treffpunkt', 'Anpfiff', 'Begegnung', 'Spielort']];
  const body = rows.map((f) => [
    formatDateDe(f.starts_at),
    meetupLabel(f),
    kickoffLabel(f),
    formatChampionshipEncounter(f, opts.teamName),
    f.location?.trim() || '–',
  ]);

  const logoMm = 5.5;
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
        fontSize: 8.5,
        cellPadding: { top: 2.4, right: 2, bottom: 2.4, left: 2 },
        textColor: [25, 25, 25],
        lineColor: [170, 170, 170],
        lineWidth: 0.15,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [236, 236, 236],
        textColor: [20, 20, 20],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 'auto', cellPadding: { top: 2.4, right: 2, bottom: 2.4, left: 9 } },
        4: { cellWidth: 48 },
      },
      margin: { left: margin, right: margin, bottom: 12 },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== encounterColIndex) return;
        const f = rows[data.row.index];
        if (!f) return;
        const oppName = (f.opponent || '').trim();
        const oppLogo = oppLogoCache.get(oppName) || placeholderData;
        // Links = Heim, Rechts = Gast
        const leftLogo = f.is_home ? ourLogoData : oppLogo;
        const rightLogo = f.is_home ? oppLogo : ourLogoData;
        const cy = data.cell.y + (data.cell.height - logoMm) / 2;
        safeAddImage(doc, leftLogo, data.cell.x + 1.2, cy, logoMm, logoMm);
        safeAddImage(
          doc,
          rightLogo,
          data.cell.x + data.cell.width - logoMm - 1.2,
          cy,
          logoMm,
          logoMm,
        );
      },
      didDrawPage: (data) => {
        drawFooter(data.pageNumber, doc.getNumberOfPages());
      },
    });
  }

  doc.save(filename);
  return { error: null, filename };
}
