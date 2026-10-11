import type { jsPDF } from 'jspdf';
import spielzeitappIcon from '../assets/branding/spielzeitapp-icon.png';

/** Same original assets as SpielzeitAppBrand, on a dark panel for white paper. */
export const PDF_BRAND_ICON_URL = spielzeitappIcon;
export const PDF_BRAND_WORDMARK_URL = `${import.meta.env.BASE_URL || '/'}intro/spielzeitapp-wordmark-angular.png`;

export function drawPdfBranding(doc: jsPDF, icon: string | null, wordmark: string | null,
  x: number, y: number, width = 42, height = 10): void {
  doc.setFillColor(9, 9, 11);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'F');
  const iconSize = height - 1;
  if (icon) doc.addImage(icon, 'PNG', x + 0.5, y + 0.5, iconSize, iconSize);
  const wordmarkWidth = width - iconSize - 2;
  const wordmarkHeight = wordmarkWidth * 141 / 689;
  if (wordmark) doc.addImage(wordmark, 'PNG', x + iconSize + 0.5,
    y + (height - wordmarkHeight) / 2, wordmarkWidth, wordmarkHeight);
  else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('SpielzeitApp', x + iconSize + 0.5, y + height / 2 + 1);
  }
}
