import type { PDFPageProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ExerciseFocus, TrainingPhase } from './trainingPhases';
import { createTrainingExerciseShortText } from './trainingExerciseShortText';

const MAX_PDF_BYTES = 15 * 1024 * 1024;

async function loadPdfJs() {
  if (typeof document === 'undefined') {
    return import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return pdfjs;
}

type TextToken = {
  text: string;
  x: number;
  y: number;
  width: number;
};

type PdfPageData = {
  page: PDFPageProxy;
  tokens: TextToken[];
  lines: string[];
  width: number;
};

export type ImportedExerciseDraft = {
  title: string;
  description: string;
  focus: ExerciseFocus;
  suitablePhases: TrainingPhase[];
  ageGroup: string;
  durationMinutes: number;
  playerCountMin: string;
  playerCountMax: string;
  materials: string;
  organization: string;
  coachingPoints: string;
  variations: string;
  shortContent: string;
  shortMaterials: string;
  shortCoaching: string;
  sourceReference: string;
  sketch: Blob | null;
};

function normalize(value: string): string {
  return value.replace(/\u00ad/g, '').replace(/[ \t]+/g, ' ').trim();
}

function linesFromTokens(tokens: TextToken[], xMin = 0, xMax = Number.POSITIVE_INFINITY): string[] {
  const selected = tokens.filter((token) => token.x >= xMin && token.x < xMax && token.text.trim());
  const groups: Array<{ y: number; tokens: TextToken[] }> = [];
  for (const token of selected.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const group = groups.find((candidate) => Math.abs(candidate.y - token.y) <= 2.5);
    if (group) group.tokens.push(token);
    else groups.push({ y: token.y, tokens: [token] });
  }
  return groups
    .sort((a, b) => b.y - a.y)
    .map((group) => normalize(group.tokens.sort((a, b) => a.x - b.x).map((token) => token.text).join(' ')))
    .filter(Boolean);
}

function firstMatch(text: string, regex: RegExp): string {
  return normalize(text.match(regex)?.[1] ?? '');
}

function textBetween(lines: string[], start: RegExp, end: RegExp): string {
  const startIndex = lines.findIndex((line) => start.test(line));
  if (startIndex < 0) return '';
  const collected: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (end.test(lines[index])) break;
    collected.push(lines[index]);
  }
  return normalize(collected.filter((line) => !/Niederösterreichischer Fußballverband/i.test(line)).join(' '));
}

function compactHeading(value: string): string {
  return normalize(value).replace(/\s+/g, '').replace(/[·:]/g, '').toLowerCase();
}

function textAfterHeading(
  lines: string[],
  startHeading: string,
  endHeadings: string[],
): string {
  const start = compactHeading(startHeading);
  const ends = endHeadings.map(compactHeading);
  const startIndex = lines.findIndex((line) => compactHeading(line) === start);
  if (startIndex < 0) return '';
  const collected: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const compact = compactHeading(lines[index]);
    if (ends.some((heading) => compact === heading || compact.startsWith(heading))) break;
    if (/^AI FOOTBALL COACH/i.test(lines[index]) || /^Seite\s+\d/i.test(lines[index])) break;
    collected.push(lines[index]);
  }
  return normalize(collected.join(' '));
}

function materialSummary(tokens: TextToken[]): string {
  const labels = ['Bälle', 'Überzieher', 'Scheiben', 'Hütchen', 'Ringe', 'Stangen', 'Tor 5 X 2 M', 'Tor 7,32 X 2,44 M'];
  const values = labels.flatMap((label) => {
    const token = tokens.find((candidate) => normalize(candidate.text).toLowerCase() === label.toLowerCase());
    if (!token) return [];
    const value = tokens
      .filter((candidate) => candidate.y < token.y && token.y - candidate.y < 28)
      .sort((a, b) => Math.abs(a.x - token.x) - Math.abs(b.x - token.x))[0];
    if (!value || Math.abs(value.x - token.x) > 35 || value.text.trim() === '/') return [];
    const normalizedValue = normalize(value.text);
    if (/^ja$/i.test(normalizedValue)) return [label];
    if (/^optional$/i.test(normalizedValue)) return [`${label} optional`];
    return [`${label}: ${normalizedValue}`];
  });
  const hasAgeBasedGoal = values.some((value) => /Tor 5|Tor 7/.test(value));
  return [...values.filter((value) => !/Tor 5|Tor 7/.test(value)), ...(hasAgeBasedGoal ? ['2 Tore (altersgerecht)'] : [])].join(', ');
}

function inferFocus(title: string, theme: string, description: string): ExerciseFocus {
  const haystack = `${title} ${theme} ${description}`.toLowerCase();
  if (/1\. kontakt|ballmitnahme|ballkontrolle/.test(haystack)) return 'ballkontrolle';
  if (/abschluss|torschuss|schuss/.test(haystack)) return 'abschluss';
  if (/pass|zuspiel/.test(haystack)) return 'passspiel';
  if (/wettbewerb|spielform/.test(haystack)) return 'spielform';
  return 'technik';
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
}

async function extractSketch(
  page: PDFPageProxy,
  tokens: TextToken[],
  pageWidth: number,
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const descriptionHeader = tokens.find((token) => /Beschreibung/i.test(token.text));
  const coachingHeader = tokens.find((token) => /Coachingpunkte/i.test(token.text));
  if (!descriptionHeader || !coachingHeader || descriptionHeader.y <= coachingHeader.y) return null;

  const scale = 2;
  const viewport = page.getViewport({ scale });
  const rendered = document.createElement('canvas');
  rendered.width = Math.ceil(viewport.width);
  rendered.height = Math.ceil(viewport.height);
  const context = rendered.getContext('2d');
  if (!context) return null;
  await page.render({ canvas: rendered, canvasContext: context, viewport }).promise;

  const sourceX = Math.floor(pageWidth * 0.55 * scale);
  const sourceY = Math.max(0, Math.floor((viewport.height / scale - descriptionHeader.y + 12) * scale));
  const sourceBottom = Math.min(
    rendered.height,
    Math.ceil((viewport.height / scale - coachingHeader.y - 8) * scale),
  );
  const sourceWidth = rendered.width - sourceX;
  const sourceHeight = sourceBottom - sourceY;
  if (sourceWidth < 200 || sourceHeight < 140) return null;

  const crop = document.createElement('canvas');
  crop.width = sourceWidth;
  crop.height = sourceHeight;
  const cropContext = crop.getContext('2d');
  if (!cropContext) return null;
  cropContext.fillStyle = '#ffffff';
  cropContext.fillRect(0, 0, crop.width, crop.height);
  cropContext.drawImage(rendered, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return canvasToBlob(crop);
}

async function extractCoachTemplateSketch(page: PDFPageProxy): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const rendered = document.createElement('canvas');
  rendered.width = Math.ceil(viewport.width);
  rendered.height = Math.ceil(viewport.height);
  const context = rendered.getContext('2d');
  if (!context) return null;
  await page.render({ canvas: rendered, canvasContext: context, viewport }).promise;

  // AI-Football-Coach-Vorlage: Spielfeldskizze zwischen Schwerpunktbox und Ablaufblock.
  const sourceX = Math.floor(rendered.width * 0.075);
  const sourceY = Math.floor(rendered.height * 0.345);
  const sourceWidth = Math.floor(rendered.width * 0.85);
  const sourceHeight = Math.floor(rendered.height * 0.4);
  const crop = document.createElement('canvas');
  crop.width = sourceWidth;
  crop.height = sourceHeight;
  const cropContext = crop.getContext('2d');
  if (!cropContext) return null;
  cropContext.fillStyle = '#ffffff';
  cropContext.fillRect(0, 0, crop.width, crop.height);
  cropContext.drawImage(rendered, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return canvasToBlob(crop);
}

async function extractMhFootballSketch(page: PDFPageProxy): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const rendered = document.createElement('canvas');
  rendered.width = Math.ceil(viewport.width);
  rendered.height = Math.ceil(viewport.height);
  const context = rendered.getContext('2d');
  if (!context) return null;
  await page.render({ canvas: rendered, canvasContext: context, viewport }).promise;

  const sourceX = Math.floor(rendered.width * 0.07);
  const sourceY = Math.floor(rendered.height * 0.05);
  const sourceWidth = Math.floor(rendered.width * 0.49);
  const sourceHeight = Math.floor(rendered.height * 0.27);
  const crop = document.createElement('canvas');
  crop.width = sourceWidth;
  crop.height = sourceHeight;
  const cropContext = crop.getContext('2d');
  if (!cropContext) return null;
  cropContext.fillStyle = '#ffffff';
  cropContext.fillRect(0, 0, crop.width, crop.height);
  cropContext.drawImage(rendered, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return canvasToBlob(crop);
}

function joinedRange(lines: string[], start: RegExp, end: RegExp): string {
  const startIndex = lines.findIndex((line) => start.test(line));
  if (startIndex < 0) return '';
  const values: string[] = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    if (index > startIndex && end.test(lines[index])) break;
    values.push(lines[index]);
  }
  return normalize(values.join(' '));
}

function phaseFromText(text: string): TrainingPhase[] {
  const compact = compactHeading(text);
  if (compact.includes('aufwärmen')) return ['AW'];
  if (compact.includes('schlussteil') || compact.includes('abschluss')) return ['AK'];
  return ['HT1'];
}

function playerCountFromTitle(title: string): { min: string; max: string } {
  const match = title.match(/(\d+)\s*vs\s*(\d+)(?:\s*\+\s*(\d+))?/i);
  if (!match) return { min: '', max: '' };
  const total = Number(match[1]) + Number(match[2]) + Number(match[3] ?? 0);
  return { min: String(total), max: String(total) };
}

export async function analyzeTrainingExercisePdf(file: File): Promise<ImportedExerciseDraft> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Bitte eine PDF-Datei auswählen.');
  }
  if (file.size > MAX_PDF_BYTES) throw new Error('Die PDF darf maximal 15 MB groß sein.');

  const data = new Uint8Array(await file.arrayBuffer());
  const pdfjs = await loadPdfJs();
  const documentTask = pdfjs.getDocument({ data });
  const pdf = await documentTask.promise;
  if (pdf.numPages < 1) throw new Error('Die PDF enthält keine lesbare Seite.');

  const metadata = await pdf.getMetadata().catch(() => null);
  const info = metadata?.info as { Author?: string; CreationDate?: string; Title?: string } | undefined;
  const pages: PdfPageData[] = [];
  const documentLines: string[] = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 12); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const tokens = content.items.flatMap((item) => {
      if (!('str' in item) || !item.str.trim()) return [];
      return [{ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width }];
    });
    const lines = linesFromTokens(tokens);
    documentLines.push(...lines);
    pages.push({ page, tokens, lines, width: page.getViewport({ scale: 1 }).width });
  }
  const sourceText = documentLines.join('\n');
  const cardPage = pages.find(
    (candidate) =>
      candidate.lines.some((line) => /Beschreibung/i.test(line)) &&
      candidate.lines.some((line) => /Coachingpunkte/i.test(line)),
  );
  const coachOverviewPage = pages.find((candidate) =>
    candidate.lines.some((line) => compactHeading(line).includes('ablauf&beschreibung')),
  );
  const coachDetailPage = pages.find(
    (candidate) =>
      candidate.lines.some((line) => compactHeading(line) === 'ablauf') &&
      candidate.lines.some((line) => compactHeading(line) === 'coachingpunkte'),
  );
  const mhFootballPage = pages.find(
    (candidate) =>
      candidate.lines.some((line) => /^Warm-up\s+\d+/i.test(line)) &&
      candidate.lines.some((line) => /Aufbau\s*&\s*Organisation/i.test(line)) &&
      candidate.lines.some((line) => /^Tipp:/i.test(line)),
  );

  let title = '';
  let theme = '';
  let ageGroup = '';
  let description = '';
  let coachingPoints = '';
  let variations = '';
  let organization = '';
  let materials = '';
  let suitablePhases: TrainingPhase[] = ['HT1'];
  let playerCountMin = '';
  let playerCountMax = '';
  let sketch: Blob | null = null;

  if (cardPage) {
    const fullText = cardPage.lines.join('\n');
    const leftLines = linesFromTokens(cardPage.tokens, 20, cardPage.width * 0.53);
    const rightLines = linesFromTokens(cardPage.tokens, cardPage.width * 0.58, cardPage.width - 20);
    const players = fullText.match(/Spieler[_\s-]*innenanzahl:\s*(\d+)\s*[-–]\s*(\d+)/i);
    const load = firstMatch(fullText, /Belastung:\s*([^\n]+)/i).split(/Material:/i)[0].trim();
    const field = firstMatch(fullText, /Feldgröße:\s*([^\n]+)/i);
    title = firstMatch(fullText, /[„“\"]([^„“\"\n]{2,80})[„“\"]/);
    theme = firstMatch(fullText, /Thema:\s*([^\n]+)/i).split(/Altersbereich:/i)[0].trim();
    ageGroup = firstMatch(fullText, /Altersbereich:\s*([^\n]+)/i).split(/Spieler/i)[0].trim();
    description = textBetween(leftLines, /Beschreibung/i, /Coachingpunkte/i);
    coachingPoints = textBetween(leftLines, /Coachingpunkte/i, /Video QR|Videolink/i);
    variations = textBetween(rightLines, /Variation/i, /Video QR|Videolink/i);
    organization = [field ? `Feld: ${field}` : '', load ? `Belastung: ${load}` : ''].filter(Boolean).join('\n');
    materials = materialSummary(cardPage.tokens);
    playerCountMin = players?.[1] ?? '';
    playerCountMax = players?.[2] ?? '';
    sketch = await extractSketch(cardPage.page, cardPage.tokens, cardPage.width);
  } else if (coachOverviewPage && coachDetailPage) {
    title = normalize(info?.Title ?? '') || file.name.replace(/\.pdf$/i, '');
    const categoryLine = coachOverviewPage.lines.find((line) => /Spielaufbau|Ballbesitzspiel/i.test(line)) ?? '';
    theme = firstMatch(categoryLine, /(.+?)(?=Alle Altersklassen|U\d+)/i) || categoryLine;
    const ageLine = coachOverviewPage.lines.find((line) => /Alle Altersklassen|U\d+/i.test(line)) ?? '';
    ageGroup = /Alle Altersklassen/i.test(ageLine)
      ? 'Alle Altersklassen'
      : firstMatch(ageLine, /(U\d+(?:\s*[-–]\s*U\d+)?)/i);
    organization = textAfterHeading(coachOverviewPage.lines, 'Organisation', ['Ablauf']);
    description = textAfterHeading(coachDetailPage.lines, 'Ablauf', ['Coachingpunkte']);
    coachingPoints = textAfterHeading(coachDetailPage.lines, 'Coachingpunkte', ['Variationen']);
    variations = textAfterHeading(coachDetailPage.lines, 'Variationen', []);
    suitablePhases = phaseFromText(sourceText);
    const count = playerCountFromTitle(title);
    playerCountMin = count.min;
    playerCountMax = count.max;
    const genericMaterials = [
      /Ersatzbälle|Ball\b/i.test(sourceText) ? 'Bälle' : '',
      /markieren/i.test(sourceText) ? 'Hütchen' : '',
      /Großtor/i.test(sourceText) ? '2 Großtore' : '',
      /Mannschaft/i.test(sourceText) ? 'Überzieher' : '',
    ].filter(Boolean);
    materials = genericMaterials.join(', ');
    sketch = await extractCoachTemplateSketch(coachOverviewPage.page);
  } else if (mhFootballPage) {
    title = mhFootballPage.lines.find((line) => /^Warm-up\s+\d+/i.test(line)) ?? file.name.replace(/\.pdf$/i, '');
    const rightLines = linesFromTokens(mhFootballPage.tokens, mhFootballPage.width * 0.55, mhFootballPage.width - 20);
    organization = textAfterHeading(rightLines, 'Aufbau & Organisation', []);
    description = joinedRange(mhFootballPage.lines, /^Die Spielergruppen/i, /^Variation:/i)
      .replace(/Spieleranzahl:\s*\d+\s*[-–]\s*\d+.*$/i, '')
      .trim();
    variations = joinedRange(mhFootballPage.lines, /^Variation:/i, /^Tipp:/i).replace(/^Variation:\s*/i, '');
    coachingPoints = joinedRange(mhFootballPage.lines, /^Tipp:/i, /^Erstellt mit/i).replace(/^Tipp:\s*/i, '');
    const players = sourceText.match(/Spieleranzahl:\s*(\d+)\s*[-–]\s*(\d+)/i);
    playerCountMin = players?.[1] ?? '';
    playerCountMax = players?.[2] ?? '';
    suitablePhases = ['AW'];
    materials = [
      /Ball/i.test(sourceText) ? 'Bälle' : '',
      /Hütchen/i.test(sourceText) ? 'Hütchen' : '',
      /Stange/i.test(sourceText) ? 'Stangen' : '',
    ].filter(Boolean).join(', ');
    ageGroup = 'Alle Altersklassen';
    sketch = await extractMhFootballSketch(mhFootballPage.page);
  }

  const links = Array.from(sourceText.matchAll(/https?:\/\/\S+/g), (match) => match[0].replace(/[),.;]+$/, ''));
  const published = firstMatch(sourceText, /veröffentlicht am\s*(\d{2}\.\d{2}\.\d{4})/i);
  const formNumber = firstMatch(sourceText, /Trainingsform\s*(\d+)/i);
  const sourceParts = [
    formNumber ? `Trainingsform ${formNumber}` : file.name.replace(/\.pdf$/i, ''),
    published ? `veröffentlicht ${published}` : '',
    info?.Author ? `Autor: ${info.Author}` : '',
  ].filter(Boolean);

  await documentTask.destroy();

  if (!title || !description) {
    throw new Error('Titel oder Beschreibung konnten nicht sicher erkannt werden.');
  }

  const shortText = createTrainingExerciseShortText({
    description,
    organization,
    materials,
    coachingPoints,
    variations,
  });

  return {
    title,
    description,
    focus: inferFocus(title, theme, description),
    suitablePhases,
    ageGroup,
    durationMinutes: 15,
    playerCountMin,
    playerCountMax,
    materials,
    organization,
    coachingPoints,
    variations: [variations, ...links.map((link) => `Video: ${link}`)].filter(Boolean).join('\n'),
    shortContent: shortText.content,
    shortMaterials: shortText.materials,
    shortCoaching: shortText.coaching,
    sourceReference: sourceParts.join(' · '),
    sketch,
  };
}
