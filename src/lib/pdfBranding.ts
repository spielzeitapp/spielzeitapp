import type { jsPDF } from 'jspdf';
import spielzeitappIcon from '../assets/branding/spielzeitapp-icon.png';

/** Original brand assets with transparent backgrounds, adapted for white paper. */
export const PDF_BRAND_ICON_URL = spielzeitappIcon;
export const PDF_BRAND_WORDMARK_URL = `${import.meta.env.BASE_URL || '/'}intro/spielzeitapp-wordmark-angular.png`;

export function drawPdfBranding(doc: jsPDF, icon: string | null, wordmark: string | null,
  x: number, y: number, width = 42, height = 10): void {
  const iconSize = height - 1;
  if (icon) doc.addImage(icon, 'PNG', x + 0.5, y + 0.5, iconSize, iconSize);
  const wordmarkWidth = width - iconSize - 2;
  const wordmarkHeight = wordmarkWidth * 141 / 689;
  if (wordmark) doc.addImage(wordmark, 'PNG', x + iconSize + 0.5,
    y + (height - wordmarkHeight) / 2, wordmarkWidth, wordmarkHeight);
  else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(9, 9, 11);
    doc.text('SpielzeitApp', x + iconSize + 0.5, y + height / 2 + 1);
  }
}

/** Keep the original letter shapes and alpha; turn only neutral lettering dark. */
export async function loadPdfWordmarkData(): Promise<string | null> {
  try {
    const image = new Image();
    image.src = PDF_BRAND_WORDMARK_URL;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const [r, g, b] = pixels.data.slice(i, i + 3);
      if (Math.max(r, g, b) - Math.min(r, g, b) < 40) {
        pixels.data[i] = 9;
        pixels.data[i + 1] = 9;
        pixels.data[i + 2] = 11;
      }
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
