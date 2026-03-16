/**
 * InDesign host API bridge
 * Runs in the UXP host context (has access to `indesign` module)
 * UI communicates via window.addEventListener('message') / window.postMessage
 */

// @ts-ignore — UXP module, not available in Node/browser type defs
import indesign from 'indesign';

const app = indesign.app;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getActiveDocument() {
  if (app.documents.length === 0) throw new Error('No document open');
  return app.activeDocument;
}

function mmToPoints(mm: number): number {
  return mm * 2.834645669;
}

// ── Grid Calculator ───────────────────────────────────────────────────────────

export interface GridCalcInput {
  pageWidth: number;   // mm
  pageHeight: number;  // mm
  baseFontSize: number; // pt
  lineHeight: number;   // pt
  marginTop?: number;   // mm (optional — calculated if omitted)
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

export interface GridCalcResult {
  baselineIncrement: number;     // pt
  marginTopPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
  marginRightPt: number;
  rowCount: number;
  textAreaHeightPt: number;
  harmonousSizes: { size: number; lineHeight: number; multiplier: number }[];
  imageHeights: { rows: number; heightPt: number; heightMm: number }[];
}

export function calculateGrid(input: GridCalcInput): GridCalcResult {
  const { pageHeight, pageWidth, baseFontSize, lineHeight } = input;
  const baselineIncrement = lineHeight; // pt

  // Default margins: snap to nearest baseline multiple
  const pageHeightPt = mmToPoints(pageHeight);
  const pageWidthPt = mmToPoints(pageWidth);

  const defaultMarginPt = Math.round((pageHeightPt * 0.1) / baselineIncrement) * baselineIncrement;
  const marginTopPt = input.marginTop ? mmToPoints(input.marginTop) : defaultMarginPt;
  const marginBottomPt = input.marginBottom ? mmToPoints(input.marginBottom) : defaultMarginPt;
  const marginLeftPt = input.marginLeft ? mmToPoints(input.marginLeft) : Math.round((pageWidthPt * 0.1) / baselineIncrement) * baselineIncrement;
  const marginRightPt = input.marginRight ? mmToPoints(input.marginRight) : marginLeftPt;

  const textAreaHeightPt = pageHeightPt - marginTopPt - marginBottomPt;
  const rowCount = Math.floor(textAreaHeightPt / baselineIncrement);

  // Harmonious sizes: font sizes whose line heights are exact multiples of baseline
  const harmonousSizes: GridCalcResult['harmonousSizes'] = [];
  for (let multiplier = 1; multiplier <= 8; multiplier++) {
    const lh = baselineIncrement * multiplier;
    // Font size = ~70% of line height (typical ratio)
    const size = Math.round(lh * 0.7 * 2) / 2; // round to 0.5pt
    if (size >= baseFontSize * 0.5 && size <= baseFontSize * 6) {
      harmonousSizes.push({ size, lineHeight: lh, multiplier });
    }
  }

  // Image heights: useful module sizes (3–20 rows)
  const imageHeights = [3, 4, 5, 6, 8, 10, 12, 15, 20].map(rows => ({
    rows,
    heightPt: rows * baselineIncrement,
    heightMm: Math.round(((rows * baselineIncrement) / 2.834645669) * 10) / 10,
  }));

  return {
    baselineIncrement,
    marginTopPt,
    marginBottomPt,
    marginLeftPt,
    marginRightPt,
    rowCount,
    textAreaHeightPt,
    harmonousSizes,
    imageHeights,
  };
}

// ── Apply to Document ─────────────────────────────────────────────────────────

export function applyGridToDocument(result: GridCalcResult) {
  const doc = getActiveDocument();

  // Baseline grid
  doc.gridPreferences.baselineDivision = result.baselineIncrement;
  doc.gridPreferences.baselineStart = result.marginTopPt;
  doc.gridPreferences.baselineGridShown = true;
  doc.gridPreferences.baselineGridColor = indesign.UIColors.LIGHT_BLUE;

  // Margins
  const pages = doc.pages;
  for (let i = 0; i < pages.length; i++) {
    const page = pages.item(i);
    page.marginPreferences.top = result.marginTopPt;
    page.marginPreferences.bottom = result.marginBottomPt;
    page.marginPreferences.left = result.marginLeftPt;
    page.marginPreferences.right = result.marginRightPt;
  }
}

export function applyParagraphStyles(
  styles: { name: string; size: number; lineHeight: number; fontFamily: string; fontStyle: string }[]
) {
  const doc = getActiveDocument();

  styles.forEach(s => {
    let style;
    try {
      style = doc.paragraphStyles.itemByName(s.name);
      if (!style.isValid) throw new Error('not found');
    } catch {
      style = doc.paragraphStyles.add({ name: s.name });
    }

    style.appliedFont = s.fontFamily;
    style.fontStyle = s.fontStyle;
    style.pointSize = s.size;
    style.leading = s.lineHeight;
    style.paragraphAlignment = indesign.Justification.LEFT_ALIGN;
  });
}
