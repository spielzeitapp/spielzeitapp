import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ChampionshipFixture } from './championshipFixtures';
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

function kickoffLabel(f: ChampionshipFixture): string {
  if (!f.starts_at || isViennaPlaceholderKickoff(f.starts_at)) return 'offen';
  return utcIsoToViennaTimeHHmm(f.starts_at) || 'offen';
}

function meetupLabel(f: ChampionshipFixture): string {
  if (!f.meeting_at) return '—';
  return utcIsoToViennaTimeHHmm(f.meeting_at) || '—';
}

function statusLabel(f: ChampionshipFixture): string {
  if (f.fixture_status === 'published') return 'Veröffentlicht';
  if (f.fixture_status === 'agreed') return 'Vereinbart';
  return 'Offen';
}

function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function buildChampionshipPdfFilename(opts: {
  teamName: string;
  seasonLabel: string;
  mode: ChampionshipPdfMode;
}): string {
  const base = `spielplan-${slugify(opts.teamName)}-${slugify(opts.seasonLabel)}`;
  return opts.mode === 'published' ? `${base}.pdf` : `${base}-arbeitsstand.pdf`;
}

/** A4 Hochformat, weißer Hintergrund, echte Tabelle — Trainer-/Eltern-Export. */
export function downloadChampionshipSchedulePdf(opts: {
  fixtures: ChampionshipFixture[];
  mode: ChampionshipPdfMode;
  teamName: string;
  seasonLabel: string;
}): { error: string | null; filename: string } {
  const rows =
    opts.mode === 'published'
      ? opts.fixtures.filter((f) => f.fixture_status === 'published')
      : [...opts.fixtures];

  rows.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const filename = buildChampionshipPdfFilename({
    teamName: opts.teamName,
    seasonLabel: opts.seasonLabel,
    mode: opts.mode,
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = 16;

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SpielzeitApp', margin, y);
  y += 8;
  doc.setFontSize(13);
  doc.text(opts.teamName || 'Mannschaft', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(opts.seasonLabel || '', margin, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Meisterschaftsspielplan', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(
    opts.mode === 'published'
      ? 'Nur veröffentlichte Spiele'
      : 'Gesamter Planungsstand (Trainer)',
    margin,
    y,
  );
  y += 6;

  const head =
    opts.mode === 'all'
      ? [['Datum', 'Uhrzeit', 'Gegner', 'H/A', 'Treffpunkt', 'Spielort', 'Status']]
      : [['Datum', 'Uhrzeit', 'Gegner', 'H/A', 'Treffpunkt', 'Spielort']];

  const body = rows.map((f) => {
    const base = [
      formatDateDe(f.starts_at),
      kickoffLabel(f),
      f.opponent || '—',
      f.is_home ? 'H' : 'A',
      meetupLabel(f),
      f.location?.trim() || '—',
    ];
    if (opts.mode === 'all') base.push(statusLabel(f));
    return base;
  });

  if (body.length === 0) {
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(11);
    doc.text('Keine Spiele für diesen Export.', margin, y + 8);
  } else {
    autoTable(doc, {
      startY: y,
      head,
      body,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [20, 20, 20],
        lineColor: [180, 180, 180],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [20, 20, 20],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: margin, right: margin },
    });
  }

  doc.save(filename);
  return { error: null, filename };
}
