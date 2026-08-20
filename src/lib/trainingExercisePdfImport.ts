import type { PDFPageProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ExerciseFocus, TrainingPhase } from './trainingPhases';

const MAX_PDF_BYTES = 15 * 1024 * 1024;

async function loadPdfJs() {
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

function materialSummary(tokens: TextToken[]): string {
  const labels = ['Bälle', 'Überzieher', 'Scheiben', 'Hütchen', 'Stangen', 'Tor 5 X 2 M', 'Tor 7,32 X 2,44 M'];
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

  let selectedPage = await pdf.getPage(1);
  let selectedTokens: TextToken[] = [];
  let selectedLines: string[] = [];
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
    if (lines.some((line) => /Beschreibung/i.test(line)) && lines.some((line) => /Coachingpunkte/i.test(line))) {
      selectedPage = page;
      selectedTokens = tokens;
      selectedLines = lines;
      break;
    }
  }
  if (!selectedTokens.length) {
    throw new Error('Keine einzelne Übung mit „Beschreibung“ und „Coachingpunkte“ erkannt.');
  }

  const viewport = selectedPage.getViewport({ scale: 1 });
  const fullText = selectedLines.join('\n');
  const sourceText = documentLines.join('\n');
  const leftLines = linesFromTokens(selectedTokens, 28, viewport.width * 0.53);
  const rightLines = linesFromTokens(selectedTokens, viewport.width * 0.58, viewport.width - 20);

  const title = firstMatch(fullText, /[„“\"]([^„“\"\n]{2,80})[„“\"]/);
  const theme = firstMatch(fullText, /Thema:\s*([^\n]+)/i).split(/Altersbereich:/i)[0].trim();
  const ageGroup = firstMatch(fullText, /Altersbereich:\s*([^\n]+)/i).split(/Spieler/i)[0].trim();
  const players = fullText.match(/Spieler[_\s-]*innenanzahl:\s*(\d+)\s*[-–]\s*(\d+)/i);
  const load = firstMatch(fullText, /Belastung:\s*([^\n]+)/i).split(/Material:/i)[0].trim();
  const field = firstMatch(fullText, /Feldgröße:\s*([^\n]+)/i);
  const description = textBetween(leftLines, /Beschreibung/i, /Coachingpunkte/i);
  const coachingPoints = textBetween(leftLines, /Coachingpunkte/i, /Video QR|Videolink/i);
  const variations = textBetween(rightLines, /Variation/i, /Video QR|Videolink/i);
  const links = Array.from(fullText.matchAll(/https?:\/\/\S+/g), (match) => match[0].replace(/[),.;]+$/, ''));

  const materials = materialSummary(selectedTokens);

  const metadata = await pdf.getMetadata().catch(() => null);
  const info = metadata?.info as { Author?: string; CreationDate?: string } | undefined;
  const published = firstMatch(sourceText, /veröffentlicht am\s*(\d{2}\.\d{2}\.\d{4})/i);
  const formNumber = firstMatch(sourceText, /Trainingsform\s*(\d+)/i);
  const sourceParts = [
    formNumber ? `Trainingsform ${formNumber}` : file.name.replace(/\.pdf$/i, ''),
    published ? `veröffentlicht ${published}` : '',
    info?.Author ? `Autor: ${info.Author}` : '',
  ].filter(Boolean);

  const sketch = await extractSketch(selectedPage, selectedTokens, viewport.width);
  await documentTask.destroy();

  if (!title || !description) {
    throw new Error('Titel oder Beschreibung konnten nicht sicher erkannt werden.');
  }

  return {
    title,
    description,
    focus: inferFocus(title, theme, description),
    suitablePhases: ['HT1'],
    ageGroup,
    durationMinutes: 15,
    playerCountMin: players?.[1] ?? '',
    playerCountMax: players?.[2] ?? '',
    materials,
    organization: [field ? `Feld: ${field}` : '', load ? `Belastung: ${load}` : ''].filter(Boolean).join('\n'),
    coachingPoints,
    variations: [variations, ...links.map((link) => `Video: ${link}`)].filter(Boolean).join('\n'),
    sourceReference: sourceParts.join(' · '),
    sketch,
  };
}
