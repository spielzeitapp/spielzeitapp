import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import brandLogoMark from '../assets/branding/spielzeitapp-logo-mark.png';
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

/** Heim immer links, Auswärts rechts — ohne separate H/A-Spalte. */
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

/**
 * A4 Querformat, weißer Druck-Hintergrund.
 * Spalten: Datum · Begegnung · Uhrzeit · Treffpunkt · Spielort
 * Keine Status-Spalte.
 */
export async function downloadChampionshipSchedulePdf(opts: {
  fixtures: ChampionshipFixture[];
  mode: ChampionshipPdfMode;
  teamName: string;
  ageGroup?: string | null;
  seasonName?: string | null;
  teamLogoUrl?: string | null;
  brandLogoUrl?: string | null;
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

  const teamLogo =
    (await loadImageDataUrl(opts.teamLogoUrl || PLACEHOLDER_LOGO)) ||
    (await loadImageDataUrl(PLACEHOLDER_LOGO));
  const brandLogo = await loadImageDataUrl(opts.brandLogoUrl || brandLogoMark);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = 10;

  // Header: Teamlogo + Texte links, Brand rechts
  const logoSize = 16;
  if (teamLogo) {
    try {
      doc.addImage(teamLogo, imageFormatFromDataUrl(teamLogo), margin, y, logoSize, logoSize);
    } catch {
      /* ignore broken logo */
    }
  }

  const textX = margin + logoSize + 4;
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(opts.teamName || 'Mannschaft', textX, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const ageLine = (opts.ageGroup || '').trim();
  const seasonLine = (opts.seasonName || '').trim()
    ? `Saison ${(opts.seasonName || '').trim()}`
    : '';
  const subLines = [ageLine, seasonLine].filter(Boolean);
  doc.text(subLines.join('  ·  ') || 'Meisterschaft', textX, y + 10);

  if (brandLogo) {
    try {
      const bw = 10;
      doc.addImage(
        brandLogo,
        imageFormatFromDataUrl(brandLogo),
        pageW - margin - bw,
        y + 2,
        bw,
        bw,
      );
    } catch {
      /* ignore */
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('SpielzeitApp', pageW - margin, y + 8, { align: 'right' });
  }

  y += logoSize + 6;
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MEISTERSCHAFTSSPIELPLAN', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(
    opts.mode === 'published' ? 'Veröffentlichte Spiele' : 'Gesamter Planungsstand',
    margin,
    y,
  );
  y += 4;

  const head = [['Datum', 'Begegnung', 'Uhrzeit', 'Treffpunkt', 'Spielort']];
  const body = rows.map((f) => [
    formatDateDe(f.starts_at),
    formatChampionshipEncounter(f, opts.teamName),
    kickoffLabel(f),
    meetupLabel(f),
    f.location?.trim() || '–',
  ]);

  const drawFooter = (pageNumber: number, pageCount: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    const footerY = pageH - 6;
    doc.text(`Stand: ${formatStandDate()}`, margin, footerY);
    doc.text('Erstellt mit SpielzeitApp · spielzeitapp.at', pageW / 2, footerY, {
      align: 'center',
    });
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
        fontSize: 9,
        cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
        textColor: [25, 25, 25],
        lineColor: [160, 160, 160],
        lineWidth: 0.15,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [235, 235, 235],
        textColor: [20, 20, 20],
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 55 },
      },
      margin: { left: margin, right: margin, bottom: 12 },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        drawFooter(data.pageNumber, pageCount);
      },
    });
  }

  doc.save(filename);
  return { error: null, filename };
}
