/**
 * Saisonplan-PDF – veröffentlichte Meisterschaft + Vorbereitung + Turniere.
 * Wiederverwendet Blob-/Logo-/ÖFB-Helfer aus championshipPdf.ts.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import brandLogoHeader from '../assets/branding/spielzeitapp-header.png';
import {
  drawOefbEncounterCell,
  loadImageDataUrl,
  triggerPdfBlobDownload,
} from './championshipPdf';
import {
  seasonPhaseFilenameSlug,
  seasonPhaseHeaderSuffix,
  type SeasonPhase,
} from './seasonPhase';
import { getOurTeamLogoUrl, PLACEHOLDER_LOGO } from './teamLogos';
import { isViennaPlaceholderKickoff, utcIsoToViennaTimeHHmm } from './viennaTime';

export type SeasonPlanEventKind = 'championship' | 'friendly' | 'tournament' | 'training';

export function seasonPlanKindLabelDe(kind: SeasonPlanEventKind): string {
  if (kind === 'championship') return 'MEISTERSCHAFT';
  if (kind === 'friendly') return 'VORBEREITUNG';
  if (kind === 'tournament') return 'TURNIER';
  return 'TRAINING';
}

export type SeasonPlanRow = {
  id: string;
  kind: SeasonPlanEventKind;
  starts_at: string;
  meeting_at: string | null;
  location: string | null;
  /** Anzeige „Termin“-Spalte (Turniertitel / Text-Fallback). */
  title: string;
  /** Nur Meisterschaft/Vorbereitung – Turniere ohne H/A-Zwang. */
  is_home?: boolean | null;
  opponent?: string | null;
  opponent_logo_url?: string | null;
};

export type SeasonPlanPdfOptions = {
  teamName: string;
  ageGroup?: string | null;
  seasonName?: string | null;
  seasonPhase?: SeasonPhase | null;
  teamLogoUrl?: string | null;
  brandLogoUrl?: string | null;
  /** Default false — Trainings nur bei bewusster Auswahl. */
  includeTrainings?: boolean;
  rows: SeasonPlanRow[];
  /** Gegnername → Logo-URL (Catalog/Event/public) */
  opponentLogoUrls?: Record<string, string>;
};

/** Filter-Hinweise für Aggregation aus events. */
export function seasonPlanIncludeDefaults() {
  return {
    championshipPublishedOnly: true,
    preparationGames: true,
    tournaments: true,
    trainings: false,
  } as const;
}

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

function kickoffLabel(row: SeasonPlanRow): string {
  if (!row.starts_at || isViennaPlaceholderKickoff(row.starts_at)) return 'offen';
  return utcIsoToViennaTimeHHmm(row.starts_at) || 'offen';
}

function meetupLabel(row: SeasonPlanRow): string {
  if (!row.meeting_at) return '–';
  return utcIsoToViennaTimeHHmm(row.meeting_at) || '–';
}

/** Spielort nur Text; ggf. Name + Adresse zweizeilig. */
function venueLabel(row: SeasonPlanRow): string {
  const loc = row.location?.trim();
  if (!loc) return 'Noch offen';
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return loc;
  return `${parts[0]}\n${parts.slice(1).join(', ')}`;
}

function seasonLine(seasonName?: string | null): string {
  const seasonRaw = String(seasonName ?? '').trim();
  if (!seasonRaw) return '';
  return /^saison\b/i.test(seasonRaw) ? seasonRaw : `Saison ${seasonRaw}`;
}

function headerSubtitle(seasonName: string | null | undefined, teamName: string): string {
  const season = seasonLine(seasonName);
  const team = teamName.trim() || 'Mannschaft';
  return [season, team].filter(Boolean).join(' · ');
}

/** Eine Hauptzeile: U12 (rot) + „ – SAISONPLAN[ HERBST 2026]“ (schwarz). */
function drawSeasonPlanHeaderTitle(
  doc: jsPDF,
  x: number,
  baselineY: number,
  ageGroup?: string | null,
  phaseSuffix = '',
): void {
  const age = String(ageGroup ?? '').trim();
  const titleRest = ` – SAISONPLAN${phaseSuffix}`;
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
  doc.text(`SAISONPLAN${phaseSuffix}`, x, baselineY);
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

export function buildSeasonPlanPdfFilename(opts: {
  teamName: string;
  ageGroup?: string | null;
  seasonName?: string | null;
  seasonPhase?: SeasonPhase | null;
}): string {
  const parts = [
    'saisonplan',
    slugify(opts.teamName),
    opts.ageGroup ? slugify(opts.ageGroup) : '',
    opts.seasonName ? slugify(opts.seasonName) : '',
    seasonPhaseFilenameSlug(opts.seasonPhase),
  ].filter(Boolean);
  return `${parts.join('-')}.pdf`;
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
    const fmt = dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    doc.addImage(dataUrl, fmt, x, y, w, h);
  } catch {
    /* broken/unsupported image — PDF weiter */
  }
}

/**
 * Platzhalter: Zeilen aus Championship-Fixtures ableiten (nur Liga).
 * Vollständige Aggregation: `loadSeasonPlanRows` in seasonPlanData.ts.
 */
export function championshipFixturesToSeasonPlanRows(
  fixtures: Array<{
    id: string;
    fixture_status: string | null;
    starts_at: string;
    meeting_at: string | null;
    location: string | null;
    is_home: boolean | null;
    opponent: string | null;
    opponent_logo_url?: string | null;
  }>,
  ourTeamName: string,
): SeasonPlanRow[] {
  const us = (ourTeamName || 'Heim').trim() || 'Heim';
  return fixtures
    .filter((f) => f.fixture_status === 'published')
    .map((f) => {
      const them = (f.opponent || 'Gegner').trim() || 'Gegner';
      const title = f.is_home ? `${us} – ${them}` : `${them} – ${us}`;
      return {
        id: f.id,
        kind: 'championship' as const,
        starts_at: f.starts_at,
        meeting_at: f.meeting_at,
        location: f.location,
        title,
        is_home: f.is_home,
        opponent: f.opponent,
        opponent_logo_url: f.opponent_logo_url ?? null,
      };
    });
}

/**
 * A4 Querformat.
 * Spalten: Datum | Treffpunkt | Beginn | Typ | Termin | Spielort
 */
export async function downloadSeasonPlanPdf(
  opts: SeasonPlanPdfOptions,
): Promise<{ error: string | null; filename: string }> {
  const filename = buildSeasonPlanPdfFilename({
    teamName: opts.teamName || 'mannschaft',
    ageGroup: opts.ageGroup,
    seasonName: opts.seasonName,
    seasonPhase: opts.seasonPhase,
  });

  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { error: 'PDF-Export ist nur im Browser möglich.', filename };
    }
    if (!Array.isArray(opts.rows)) {
      return { error: 'Saisonplan-Daten fehlen.', filename };
    }

    const includeTrainings = opts.includeTrainings === true;
    const rows = opts.rows.filter((r) => includeTrainings || r.kind !== 'training');

    const ourTeamName = (opts.teamName || 'Mannschaft').trim() || 'Mannschaft';
    const ourLogoUrl = opts.teamLogoUrl?.trim() || getOurTeamLogoUrl();
    const ourLogoData =
      (await loadImageDataUrl(ourLogoUrl)) ||
      (await loadImageDataUrl(getOurTeamLogoUrl())) ||
      (await loadImageDataUrl(PLACEHOLDER_LOGO));
    const brandLogoData = await loadImageDataUrl(opts.brandLogoUrl || brandLogoHeader);
    const placeholderData = await loadImageDataUrl(PLACEHOLDER_LOGO);

    const oppLogoCache = new Map<string, string | null>();
    for (const r of rows) {
      if (r.kind === 'tournament') continue;
      const name = (r.opponent || '').trim();
      if (!name || oppLogoCache.has(name)) continue;
      const url = opts.opponentLogoUrls?.[name] || r.opponent_logo_url || PLACEHOLDER_LOGO;
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
    const phaseSuffix = seasonPhaseHeaderSuffix(opts.seasonPhase ?? null, opts.seasonName);
    drawSeasonPlanHeaderTitle(doc, textX, y + 7, opts.ageGroup, phaseSuffix);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(45, 45, 45);
    doc.text(headerSubtitle(opts.seasonName, ourTeamName), textX, y + 13.5);

    const brandH = 10;
    const brandW = 42;
    safeAddImage(doc, brandLogoData, pageW - margin - brandW, y + 2, brandW, brandH);

    y += headerLogo + 6;

    const usable = pageW - margin * 2;
    const colDatum = Math.round(usable * 0.11);
    const colMeetup = Math.round(usable * 0.09);
    const colKick = Math.round(usable * 0.08);
    const colTyp = Math.round(usable * 0.14);
    const colVenue = Math.round(usable * 0.22);
    const colTermin = usable - colDatum - colMeetup - colKick - colTyp - colVenue;

    const head = [['Datum', 'Treffpunkt', 'Beginn', 'Typ', 'Termin', 'Spielort']];
    const body = rows.map((r) => [
      formatDateDe(r.starts_at),
      meetupLabel(r),
      kickoffLabel(r),
      seasonPlanKindLabelDe(r.kind),
      r.kind === 'tournament' ? r.title : '',
      venueLabel(r),
    ]);

    const terminColIndex = 4;

    const drawFooter = (pageNumber: number, pageCount: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 110);
      const footerY = pageH - 6;
      doc.text(`Stand: ${formatStandDate()}`, margin, footerY);
      doc.text('Erstellt mit SpielzeitApp', pageW / 2, footerY, { align: 'center' });
      doc.text(`Seite ${pageNumber} von ${pageCount}`, pageW - margin, footerY, {
        align: 'right',
      });
    };

    if (body.length === 0) {
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(11);
      doc.text('Keine Termine für diesen Saisonplan.', margin, y + 10);
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
          minCellHeight: 14.5,
        },
        headStyles: {
          fillColor: [236, 236, 236],
          textColor: [20, 20, 20],
          fontStyle: 'bold',
          fontSize: 9.5,
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: colDatum, halign: 'center', fontSize: 10 },
          1: { cellWidth: colMeetup, halign: 'center', fontSize: 10 },
          2: { cellWidth: colKick, halign: 'center', fontSize: 10 },
          3: { cellWidth: colTyp, halign: 'center', fontSize: 8.5, fontStyle: 'bold' },
          4: { cellWidth: colTermin, cellPadding: 1.5 },
          5: { cellWidth: colVenue, fontSize: 9.5 },
        },
        margin: { left: margin, right: margin, bottom: 12 },
        didDrawCell: (data) => {
          if (data.section !== 'body' || data.column.index !== terminColIndex) return;
          const row = rows[data.row.index];
          if (!row) return;

          if (row.kind === 'tournament') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(25, 25, 25);
            const pad = 2;
            const textY = data.cell.y + data.cell.height / 2 + 2.4;
            const maxW = data.cell.width - pad * 2;
            let label = row.title.trim() || 'Turnier';
            while (label.length > 3 && doc.getTextWidth(label) > maxW) {
              label = `${label.slice(0, -2)}…`;
            }
            doc.text(label, data.cell.x + pad, textY);
            return;
          }

          const oppName = (row.opponent || 'Gegner').trim() || 'Gegner';
          const oppLogo = oppLogoCache.get(oppName) || placeholderData;
          const isHome = row.is_home === true;
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
    console.error('[seasonPlanPdf] generate failed', err);
    return { error: message || 'PDF konnte nicht erstellt werden.', filename };
  }
}
