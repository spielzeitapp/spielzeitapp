import { strToU8, zipSync } from 'fflate';
import type { TrainingExerciseRow } from './trainingExercises';
import type { TrainingSessionExerciseRow, TrainingSessionRow } from './trainingSessions';
import { TRAINING_PHASE_LABELS, TRAINING_PHASE_SHORT } from './trainingPhases';

type WordExercise = {
  item: TrainingSessionExerciseRow;
  exercise: TrainingExerciseRow;
  image: Uint8Array | null;
};

export type TrainingSessionWordInput = {
  session: TrainingSessionRow;
  items: TrainingSessionExerciseRow[];
  exerciseMap: Record<string, TrainingExerciseRow>;
  trainerName?: string | null;
  teamName?: string | null;
  dateIso?: string | null;
  resolveSketchPng?: (path: string | null) => Promise<Uint8Array | null>;
};

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PAGE_SIZE = '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>';
const PAGE_MARGIN = '<w:pgMar w:top="500" w:right="500" w:bottom="500" w:left="500" w:header="240" w:footer="240" w:gutter="0"/>';
const TABLE_WIDTHS = [4700, 4200, 2400, 4300] as const;

function xml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clean(value: unknown, fallback = '—'): string {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  return text || fallback;
}

function run(text: string, options?: { bold?: boolean; size?: number; color?: string }): string {
  const size = options?.size ?? 15;
  const props = [
    '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/>',
    options?.bold ? '<w:b/><w:bCs/>' : '',
    options?.color ? `<w:color w:val="${options.color}"/>` : '',
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`,
  ].join('');
  const lines = text.split('\n');
  return `<w:r><w:rPr>${props}</w:rPr>${lines
    .map((line, index) => `${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${xml(line)}</w:t>`)
    .join('')}</w:r>`;
}

function paragraph(
  content: string,
  options?: { after?: number; before?: number; align?: 'left' | 'center' | 'right'; keepNext?: boolean },
): string {
  return `<w:p><w:pPr>${options?.align ? `<w:jc w:val="${options.align}"/>` : ''}${
    options?.keepNext ? '<w:keepNext/>' : ''
  }<w:spacing w:before="${options?.before ?? 0}" w:after="${options?.after ?? 30}" w:line="210" w:lineRule="auto"/></w:pPr>${content}</w:p>`;
}

function exerciseHeading(entry: WordExercise): string {
  const phase = TRAINING_PHASE_SHORT[entry.item.phase];
  return paragraph(
    run(`${phase} · ${entry.exercise.title} · ${entry.item.duration_minutes} Min.`, {
      bold: true,
      size: 15,
      color: '17365D',
    }),
    { after: 20, keepNext: true },
  );
}

function labeledText(label: string, value: string | null | undefined): string {
  const text = clean(value);
  return paragraph(`${run(`${label}: `, { bold: true, size: 14 })}${run(text, { size: 14 })}`, {
    after: 35,
  });
}

function cell(content: string, width: number, options?: { fill?: string; center?: boolean }): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="top"/><w:tcMar><w:top w:w="70" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>${
    options?.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.fill}"/>` : ''
  }</w:tcPr>${options?.center ? content.replace(/<w:pPr>/g, '<w:pPr><w:jc w:val="center"/>') : content}</w:tc>`;
}

function imageDrawing(relationshipId: string, drawingId: number, title: string): string {
  const cx = 3370000;
  const cy = 1300000;
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${drawingId}" name="Skizze ${drawingId}" descr="${xml(
    title,
  )}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${drawingId}" name="${xml(
    title,
  )}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function organizationBlock(entry: WordExercise, index: number): string {
  const heading = exerciseHeading(entry);
  const sketch = entry.image
    ? paragraph(imageDrawing(`rIdImage${index + 1}`, index + 1, entry.exercise.title), {
        after: 15,
        align: 'center',
      })
    : paragraph(run('Keine Skizze hinterlegt', { size: 13, color: '777777' }), {
        after: 15,
        align: 'center',
      });
  const organization = entry.exercise.organization
    ? labeledText('Aufbau', entry.exercise.organization)
    : '';
  return `${heading}${sketch}${organization}`;
}

function contentBlock(entry: WordExercise): string {
  const notes = entry.item.coach_notes
    ? labeledText('Trainerhinweis', entry.item.coach_notes)
    : '';
  return `${exerciseHeading(entry)}${paragraph(run(clean(entry.exercise.description), { size: 14 }), {
    after: 35,
  })}${notes}`;
}

function materialBlock(entry: WordExercise): string {
  return `${exerciseHeading(entry)}${paragraph(run(clean(entry.exercise.materials), { size: 14 }), {
    after: 45,
  })}`;
}

function coachingBlock(entry: WordExercise): string {
  const variations = entry.exercise.variations
    ? labeledText('Variation', entry.exercise.variations)
    : '';
  return `${exerciseHeading(entry)}${paragraph(run(clean(entry.exercise.coaching_points), { size: 14 }), {
    after: 25,
  })}${variations}`;
}

function headerTable(input: TrainingSessionWordInput, pageNumber: number, pageCount: number): string {
  const date = input.dateIso
    ? new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
        new Date(input.dateIso),
      )
    : '';
  const title = clean(input.session.title, 'Trainingseinheit');
  const objective = clean(input.session.objective, title);
  const trainer = clean(input.trainerName, '');
  const team = clean(input.teamName, input.session.age_group ?? '');
  const total = input.items.reduce((sum, item) => sum + Math.max(0, item.duration_minutes || 0), 0);
  const fullWidth = TABLE_WIDTHS.reduce((sum, width) => sum + width, 0);
  return `<w:tbl><w:tblPr><w:tblW w:w="${fullWidth}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="333333"/><w:left w:val="single" w:sz="6" w:color="333333"/><w:bottom w:val="single" w:sz="6" w:color="333333"/><w:right w:val="single" w:sz="6" w:color="333333"/><w:insideH w:val="single" w:sz="4" w:color="999999"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${fullWidth}"/></w:tblGrid><w:tr>${cell(
    paragraph(run('NÖFV-ÖFB-D-Diplom', { size: 15 }), { after: 0 }),
    fullWidth,
  )}</w:tr><w:tr>${cell(
    paragraph(
      `${run(`Trainingseinheit: ${title}`, { bold: true, size: 20 })}${run(
        `    Schwerpunkt: ${objective}`,
        { bold: true, size: 17 },
      )}`,
      { after: 0 },
    ),
    fullWidth,
  )}</w:tr><w:tr>${cell(
    paragraph(
      `${run(`Trainer: ${trainer}`, { size: 15 })}${run(`    Mannschaft: ${team}`, {
        size: 15,
      })}${run(`    Datum: ${date}`, { size: 15 })}${run(`    Dauer: ${total} Min.`, {
        size: 15,
      })}${run(`    Seite: ${pageNumber}/${pageCount}`, { size: 15 })}`,
      { after: 0 },
    ),
    fullWidth,
  )}</w:tr></w:tbl>`;
}

function exerciseTable(entries: WordExercise[], startIndex: number): string {
  const headerLabels = ['Inhalte', 'Organisation (Skizzen)', 'Geräte', 'Coachingpunkte'];
  const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headerLabels
    .map((label, index) =>
      cell(paragraph(run(label, { bold: true, size: 15 }), { after: 0, align: 'center' }), TABLE_WIDTHS[index], {
        fill: 'E7EDF5',
      }),
    )
    .join('')}</w:tr>`;
  const content = entries.map(contentBlock).join('');
  const organization = entries.map((entry, index) => organizationBlock(entry, startIndex + index)).join('');
  const materials = entries.map(materialBlock).join('');
  const coaching = entries.map(coachingBlock).join('');
  const bodyRow = `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(content, TABLE_WIDTHS[0])}${cell(
    organization,
    TABLE_WIDTHS[1],
  )}${cell(materials, TABLE_WIDTHS[2])}${cell(coaching, TABLE_WIDTHS[3])}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="15600" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="333333"/><w:left w:val="single" w:sz="6" w:color="333333"/><w:bottom w:val="single" w:sz="6" w:color="333333"/><w:right w:val="single" w:sz="6" w:color="333333"/><w:insideH w:val="single" w:sz="4" w:color="777777"/><w:insideV w:val="single" w:sz="4" w:color="777777"/></w:tblBorders></w:tblPr><w:tblGrid>${TABLE_WIDTHS.map(
    (width) => `<w:gridCol w:w="${width}"/>`,
  ).join('')}</w:tblGrid>${headerRow}${bodyRow}</w:tbl>`;
}

async function blobToPng(blob: Blob): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Skizze konnte nicht geladen werden.'));
      image.src = objectUrl;
    });
    const targetWidth = 1200;
    const targetHeight = Math.round((targetWidth * 1300000) / 3370000);
    const scale = Math.min(
      targetWidth / Math.max(1, image.naturalWidth),
      targetHeight / Math.max(1, image.naturalHeight),
    );
    const drawWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    const drawHeight = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      Math.round((targetWidth - drawWidth) / 2),
      Math.round((targetHeight - drawHeight) / 2),
      drawWidth,
      drawHeight,
    );
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
    return png ? new Uint8Array(await png.arrayBuffer()) : null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadSketch(path: string | null): Promise<Uint8Array | null> {
  if (!path || typeof document === 'undefined') return null;
  try {
    const { getTrainingExerciseSketchUrl } = await import('./trainingExercises');
    const url = await getTrainingExerciseSketchUrl(path);
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await blobToPng(await response.blob());
  } catch {
    return null;
  }
}

function stylesXml(): string {
  return `${XML_HEADER}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/><w:sz w:val="15"/><w:szCs w:val="15"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="30" w:line="210" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
}

function contentTypesXml(hasImages: boolean): string {
  return `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${
    hasImages ? '<Default Extension="png" ContentType="image/png"/>' : ''
  }<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

export async function buildTrainingSessionWord(input: TrainingSessionWordInput): Promise<Uint8Array> {
  const ordered = [...input.items].sort(
    (a, b) =>
      ['AW', 'HT1', 'HT2', 'AK'].indexOf(a.phase) - ['AW', 'HT1', 'HT2', 'AK'].indexOf(b.phase) ||
      a.sort_order - b.sort_order,
  );
  if (!ordered.length) throw new Error('Die Trainingseinheit enthält noch keine Übungen.');
  const entries = (
    await Promise.all(
      ordered.map(async (item) => {
        const exercise = input.exerciseMap[item.exercise_id] ?? item.exercise;
        if (!exercise) return null;
        const image = input.resolveSketchPng
          ? await input.resolveSketchPng(exercise.image_path)
          : await loadSketch(exercise.image_path);
        return { item, exercise, image } satisfies WordExercise;
      }),
    )
  ).filter((entry): entry is WordExercise => entry != null);
  if (!entries.length) throw new Error('Die Übungen konnten nicht geladen werden.');

  const groups: WordExercise[][] = [];
  for (let index = 0; index < entries.length; index += 3) groups.push(entries.slice(index, index + 3));
  const body = groups
    .map((group, pageIndex) => {
      const startIndex = pageIndex * 3;
      const page = `${headerTable(input, pageIndex + 1, groups.length)}${exerciseTable(group, startIndex)}`;
      return pageIndex < groups.length - 1
        ? `${page}${paragraph('<w:r><w:br w:type="page"/></w:r>', { after: 0 })}`
        : page;
    })
    .join('');

  const documentXml = `${XML_HEADER}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr>${PAGE_SIZE}${PAGE_MARGIN}</w:sectPr></w:body></w:document>`;
  const imageRelationships = entries
    .map((entry, index) =>
      entry.image
        ? `<Relationship Id="rIdImage${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/exercise-${index + 1}.png"/>`
        : '',
    )
    .join('');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypesXml(entries.some((entry) => entry.image))),
    '_rels/.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    ),
    'docProps/core.xml': strToU8(
      `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(
        input.session.title,
      )}</dc:title><dc:creator>SpielzeitApp</dc:creator><cp:lastModifiedBy>SpielzeitApp</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
    ),
    'docProps/app.xml': strToU8(
      `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SpielzeitApp</Application><AppVersion>1.0</AppVersion></Properties>`,
    ),
    'word/document.xml': strToU8(documentXml),
    'word/styles.xml': strToU8(stylesXml()),
    'word/settings.xml': strToU8(
      `${XML_HEADER}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="90"/><w:defaultTabStop w:val="720"/></w:settings>`,
    ),
    'word/_rels/document.xml.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${imageRelationships}</Relationships>`,
    ),
  };
  entries.forEach((entry, index) => {
    if (entry.image) files[`word/media/exercise-${index + 1}.png`] = entry.image;
  });
  return zipSync(files, { level: 6 });
}

function safeFilename(value: string): string {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return cleaned || 'Trainingseinheit';
}

export async function downloadTrainingSessionWord(input: TrainingSessionWordInput): Promise<void> {
  const bytes = await buildTrainingSessionWord(input);
  const blob = new Blob([bytes], { type: WORD_MIME });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFilename(input.session.title)}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}
